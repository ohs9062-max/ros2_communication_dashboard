// Copyright 2026 hs
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>

#include <fastdds/rtps/builtin/data/ReaderProxyData.h>
#include <fastdds/rtps/builtin/data/WriterProxyData.h>
#include <fastdds/rtps/common/Time_t.h>
#include <fastrtps/qos/QosPolicies.h>

#include <atomic>
#include <csignal>
#include <cstdint>
#include <cstdlib>
#include <iostream>
#include <map>
#include <mutex>
#include <optional>
#include <sstream>
#include <string>

#include <fastdds/dds/domain/DomainParticipant.hpp>
#include <fastdds/dds/domain/DomainParticipantFactory.hpp>
#include <fastdds/dds/domain/DomainParticipantListener.hpp>
#include <fastdds/dds/domain/qos/DomainParticipantQos.hpp>

namespace fastdds_dds = eprosima::fastdds::dds;
namespace rtps = eprosima::fastrtps::rtps;

namespace
{

constexpr uint16_t kDefaultPort = 8766;
std::atomic<bool> running{true};
int server_fd = -1;

struct DurationValue
{
  std::optional<int64_t> nanoseconds;
  bool infinite{false};
  bool observed{true};
};

struct Endpoint
{
  std::string guid;
  std::string dds_topic;
  std::string dds_type;
  std::string service_name;
  std::string service_channel;
  std::string endpoint_kind;
  std::string service_role;
  std::string reliability;
  std::string durability;
  std::string liveliness;
  DurationValue deadline;
  DurationValue lifespan;
  DurationValue liveliness_lease_duration;
};

std::string json_escape(const std::string & value)
{
  std::ostringstream output;
  for (const unsigned char character : value) {
    switch (character) {
      case '"': output << "\\\""; break;
      case '\\': output << "\\\\"; break;
      case '\b': output << "\\b"; break;
      case '\f': output << "\\f"; break;
      case '\n': output << "\\n"; break;
      case '\r': output << "\\r"; break;
      case '\t': output << "\\t"; break;
      default:
        if (character < 0x20) {
          output << "?";
        } else {
          output << character;
        }
    }
  }
  return output.str();
}

std::string quoted(const std::string & value)
{
  return "\"" + json_escape(value) + "\"";
}

DurationValue duration_value(const eprosima::fastrtps::Duration_t & duration)
{
  if (duration.is_infinite()) {
    return {std::nullopt, true, true};
  }
  return {duration.to_ns(), false, true};
}

std::string duration_json(const char * name, const DurationValue & value)
{
  std::ostringstream output;
  output << quoted(std::string(name) + "_ns") << ':';
  if (value.nanoseconds.has_value()) {
    output << *value.nanoseconds;
  } else {
    output << "null";
  }
  output << ',' << quoted(std::string(name) + "_status") << ':'
         << quoted(!value.observed ? "unknown" : value.infinite ? "infinite" : "observed");
  return output.str();
}

std::string reliability_name(const eprosima::fastrtps::ReliabilityQosPolicyKind kind)
{
  switch (kind) {
    case eprosima::fastrtps::BEST_EFFORT_RELIABILITY_QOS: return "best_effort";
    case eprosima::fastrtps::RELIABLE_RELIABILITY_QOS: return "reliable";
    default: return "unknown";
  }
}

std::string durability_name(const eprosima::fastrtps::DurabilityQosPolicyKind kind)
{
  switch (kind) {
    case eprosima::fastrtps::VOLATILE_DURABILITY_QOS: return "volatile";
    case eprosima::fastrtps::TRANSIENT_LOCAL_DURABILITY_QOS: return "transient_local";
    case eprosima::fastrtps::TRANSIENT_DURABILITY_QOS: return "transient";
    case eprosima::fastrtps::PERSISTENT_DURABILITY_QOS: return "persistent";
    default: return "unknown";
  }
}

std::string liveliness_name(const eprosima::fastrtps::LivelinessQosPolicyKind kind)
{
  switch (kind) {
    case eprosima::fastrtps::AUTOMATIC_LIVELINESS_QOS: return "automatic";
    case eprosima::fastrtps::MANUAL_BY_PARTICIPANT_LIVELINESS_QOS:
      return "manual_by_participant";
    case eprosima::fastrtps::MANUAL_BY_TOPIC_LIVELINESS_QOS: return "manual_by_topic";
    default: return "unknown";
  }
}

std::optional<std::pair<std::string, std::string>> service_identity(
  const std::string & topic)
{
  std::string value;
  std::string channel;
  std::string suffix;
  if (topic.rfind("rq/", 0) == 0) {
    value = topic.substr(3);
    channel = "request";
    suffix = "Request";
  } else if (topic.rfind("rr/", 0) == 0) {
    value = topic.substr(3);
    channel = "response";
    suffix = "Reply";
  } else {
    return std::nullopt;
  }
  if (value.size() < suffix.size() ||
    value.compare(value.size() - suffix.size(), suffix.size(), suffix) != 0)
  {
    return std::nullopt;
  }
  value.erase(value.size() - suffix.size());
  if (value.empty() || value.front() != '/') {
    value.insert(value.begin(), '/');
  }
  return std::make_pair(value, channel);
}

template<typename ProxyData>
Endpoint endpoint_from_proxy(const ProxyData & proxy, const char * endpoint_kind)
{
  std::ostringstream guid;
  guid << proxy.guid();
  const auto identity = service_identity(proxy.topicName().to_string()).value();
  return {
    guid.str(),
    proxy.topicName().to_string(),
    proxy.typeName().to_string(),
    identity.first,
    identity.second,
    endpoint_kind,
    (
      (identity.second == "request" && std::string(endpoint_kind) == "reader") ||
      (identity.second == "response" && std::string(endpoint_kind) == "writer")
    ) ? "server" : "client",
    reliability_name(proxy.m_qos.m_reliability.kind),
    durability_name(proxy.m_qos.m_durability.kind),
    liveliness_name(proxy.m_qos.m_liveliness.kind),
    duration_value(proxy.m_qos.m_deadline.period),
    std::string(endpoint_kind) == "writer" ?
    duration_value(proxy.m_qos.m_lifespan.duration) :
    DurationValue{std::nullopt, false, false},
    duration_value(proxy.m_qos.m_liveliness.lease_duration),
  };
}

std::string endpoint_json(const Endpoint & endpoint)
{
  std::ostringstream output;
  output << '{'
         << "\"guid\":" << quoted(endpoint.guid) << ','
         << "\"dds_topic\":" << quoted(endpoint.dds_topic) << ','
         << "\"dds_type\":" << quoted(endpoint.dds_type) << ','
         << "\"service_name\":" << quoted(endpoint.service_name) << ','
         << "\"service_channel\":" << quoted(endpoint.service_channel) << ','
         << "\"endpoint_kind\":" << quoted(endpoint.endpoint_kind) << ','
         << "\"service_role\":" << quoted(endpoint.service_role) << ','
         << "\"qos\":{"
         << "\"reliability\":" << quoted(endpoint.reliability) << ','
         << "\"durability\":" << quoted(endpoint.durability) << ','
         << "\"history\":\"unknown\",\"depth\":null,"
         << duration_json("deadline", endpoint.deadline) << ','
         << duration_json("lifespan", endpoint.lifespan) << ','
         << "\"liveliness\":" << quoted(endpoint.liveliness) << ','
         << duration_json("liveliness_lease_duration", endpoint.liveliness_lease_duration)
         << "}}";
  return output.str();
}

class DiscoveryListener : public fastdds_dds::DomainParticipantListener
{
public:
  void on_subscriber_discovery(
    fastdds_dds::DomainParticipant *, rtps::ReaderDiscoveryInfo && info) override
  {
    update_reader(info);
  }

  void on_publisher_discovery(
    fastdds_dds::DomainParticipant *, rtps::WriterDiscoveryInfo && info) override
  {
    update_writer(info);
  }

  std::string snapshot(int domain_id) const
  {
    std::lock_guard<std::mutex> guard(mutex_);
    std::ostringstream output;
    output << "{\"available\":true,\"source\":\"fastdds_discovery\","
           << "\"domain_id\":" << domain_id << ",\"endpoints\":[";
    bool first = true;
    for (const auto & item : endpoints_) {
      if (!first) {
        output << ',';
      }
      first = false;
      output << endpoint_json(item.second);
    }
    output << "]}";
    return output.str();
  }

private:
  void update_reader(const rtps::ReaderDiscoveryInfo & info)
  {
    const auto identity = service_identity(info.info.topicName().to_string());
    if (!identity.has_value()) {
      return;
    }
    const std::string key = guid_key(info.info.guid(), "reader");
    std::lock_guard<std::mutex> guard(mutex_);
    if (info.status == rtps::ReaderDiscoveryInfo::REMOVED_READER) {
      endpoints_.erase(key);
    } else {
      endpoints_[key] = endpoint_from_proxy(info.info, "reader");
    }
  }

  void update_writer(const rtps::WriterDiscoveryInfo & info)
  {
    const auto identity = service_identity(info.info.topicName().to_string());
    if (!identity.has_value()) {
      return;
    }
    const std::string key = guid_key(info.info.guid(), "writer");
    std::lock_guard<std::mutex> guard(mutex_);
    if (info.status == rtps::WriterDiscoveryInfo::REMOVED_WRITER) {
      endpoints_.erase(key);
    } else {
      endpoints_[key] = endpoint_from_proxy(info.info, "writer");
    }
  }

  template<typename Guid>
  static std::string guid_key(const Guid & guid, const char * kind)
  {
    std::ostringstream output;
    output << kind << ':' << guid;
    return output.str();
  }

  mutable std::mutex mutex_;
  std::map<std::string, Endpoint> endpoints_;
};

int environment_integer(const char * name, int fallback, int minimum, int maximum)
{
  const char * raw = std::getenv(name);
  if (raw == nullptr) {
    return fallback;
  }
  try {
    const int value = std::stoi(raw);
    return value >= minimum && value <= maximum ? value : fallback;
  } catch (...) {
    return fallback;
  }
}

void stop([[maybe_unused]] int signal_number)
{
  running = false;
  if (server_fd >= 0) {
    shutdown(server_fd, SHUT_RDWR);
  }
}

bool send_all(int client, const std::string & response)
{
  std::size_t sent = 0;
  while (sent < response.size()) {
    const auto count = send(client, response.data() + sent, response.size() - sent, 0);
    if (count <= 0) {
      return false;
    }
    sent += static_cast<std::size_t>(count);
  }
  return true;
}

int serve(DiscoveryListener & listener, int domain_id, uint16_t port)
{
  server_fd = socket(AF_INET, SOCK_STREAM, 0);
  if (server_fd < 0) {
    return 1;
  }
  int reuse = 1;
  setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &reuse, sizeof(reuse));
  sockaddr_in address{};
  address.sin_family = AF_INET;
  address.sin_port = htons(port);
  inet_pton(AF_INET, "127.0.0.1", &address.sin_addr);
  if (bind(server_fd, reinterpret_cast<sockaddr *>(&address), sizeof(address)) < 0 ||
    listen(server_fd, 8) < 0)
  {
    close(server_fd);
    server_fd = -1;
    return 1;
  }
  std::cerr << "Fast DDS QoS observer listening on 127.0.0.1:" << port
            << " domain " << domain_id << std::endl;
  while (running) {
    const int client = accept(server_fd, nullptr, nullptr);
    if (client < 0) {
      continue;
    }
    char request[1024]{};
    const auto received = recv(client, request, sizeof(request) - 1, 0);
    const std::string request_text = received > 0 ? std::string(request, received) : "";
    const bool health = request_text.rfind("GET /health ", 0) == 0;
    const bool snapshot = request_text.rfind("GET /snapshot ", 0) == 0;
    const std::string body = health ? "{\"status\":\"ok\"}" : listener.snapshot(domain_id);
    const std::string status = (health || snapshot) ? "200 OK" : "404 Not Found";
    const std::string response = "HTTP/1.1 " + status + "\r\nContent-Type: application/json\r\n" +
      "Content-Length: " + std::to_string(body.size()) + "\r\nConnection: close\r\n\r\n" + body;
    send_all(client, response);
    close(client);
  }
  if (server_fd >= 0) {
    close(server_fd);
    server_fd = -1;
  }
  return 0;
}

}  // namespace

int main()
{
  std::signal(SIGINT, stop);
  std::signal(SIGTERM, stop);
  const int domain_id = environment_integer("ROS_DOMAIN_ID", 0, 0, 232);
  const int configured_port = environment_integer(
    "ROS2_DDS_QOS_OBSERVER_PORT", kDefaultPort, 1, 65535);

  DiscoveryListener listener;
  auto qos = fastdds_dds::PARTICIPANT_QOS_DEFAULT;
  qos.name("ros2_dashboard_fastdds_qos_observer");
  auto * factory = fastdds_dds::DomainParticipantFactory::get_instance();
  auto * participant = factory->create_participant(
    domain_id, qos, &listener, fastdds_dds::StatusMask::all());
  if (participant == nullptr) {
    std::cerr << "Failed to create Fast DDS observer participant" << std::endl;
    return 1;
  }

  const int result = serve(listener, domain_id, static_cast<uint16_t>(configured_port));
  factory->delete_participant(participant);
  return result;
}
