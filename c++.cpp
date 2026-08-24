// Copyright 2026 hs
//
// Apache License 2.0 라이선스 문구.
// 이 파일을 배포하거나 사용할 때 적용되는 라이선스 조건이다.
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


// ==============================
// Linux 네트워크 관련 헤더
// ==============================

// inet_pton(), htons() 등
// IP 주소와 네트워크 바이트 순서 변환에 사용.
#include <arpa/inet.h>

// sockaddr_in 등 IPv4 주소 구조체 사용.
#include <netinet/in.h>

// socket(), bind(), listen(), accept(), send(), recv() 사용.
#include <sys/socket.h>

// close() 사용.
#include <unistd.h>


// ==============================
// Fast DDS 내부 Discovery 정보
// ==============================

// DDS Reader(구독 측 Endpoint)의 discovery 정보를 읽기 위해 사용.
#include <fastdds/rtps/builtin/data/ReaderProxyData.h>

// DDS Writer(발행 측 Endpoint)의 discovery 정보를 읽기 위해 사용.
#include <fastdds/rtps/builtin/data/WriterProxyData.h>

// Fast DDS 시간 관련 타입.
#include <fastdds/rtps/common/Time_t.h>

// Reliability, Durability, Liveliness 등
// DDS QoS 정책 타입을 사용하기 위한 헤더.
#include <fastrtps/qos/QosPolicies.h>


// ==============================
// C++ 표준 라이브러리
// ==============================

// 여러 thread에서 안전하게 true/false 상태를 공유하기 위해 사용.
#include <atomic>

// SIGINT, SIGTERM signal 처리.
#include <csignal>

// int64_t 같은 고정 길이 정수 타입.
#include <cstdint>

// getenv() 사용.
#include <cstdlib>

// cerr 등 콘솔 출력.
#include <iostream>

// Endpoint를 key-value 형태로 저장.
#include <map>

// 여러 thread에서 endpoints_ 접근을 보호하기 위한 mutex.
#include <mutex>

// 값이 있을 수도 있고 없을 수도 있는 상태 표현.
#include <optional>

// 문자열 조립.
// JSON이나 GUID 문자열 만들 때 사용.
#include <sstream>

// std::string.
#include <string>


// ==============================
// Fast DDS DomainParticipant 관련
// ==============================

// DDS DomainParticipant 객체.
#include <fastdds/dds/domain/DomainParticipant.hpp>

// DomainParticipant 생성/삭제 factory.
#include <fastdds/dds/domain/DomainParticipantFactory.hpp>

// DDS discovery 이벤트를 받는 Listener 기반 클래스.
#include <fastdds/dds/domain/DomainParticipantListener.hpp>

// Participant QoS.
#include <fastdds/dds/domain/qos/DomainParticipantQos.hpp>


// 긴 namespace를 짧게 쓰기 위한 별칭.
//
// eprosima::fastdds::dds 대신 fastdds_dds
// eprosima::fastrtps::rtps 대신 rtps
namespace fastdds_dds = eprosima::fastdds::dds;
namespace rtps = eprosima::fastrtps::rtps;


// 이름 없는 namespace.
//
// 이 파일 안에서만 사용하는 변수/함수를 넣는다.
// 다른 cpp 파일에서 접근하지 못하게 하는 역할도 한다.
namespace
{


// Fast DDS QoS Observer의 기본 HTTP 포트.
//
// Monitor가 이 프로세스의 snapshot을 읽을 때
// 기본적으로 8766 포트를 사용한다.
constexpr uint16_t kDefaultPort = 8766;


// 프로그램 실행 상태.
//
// true:
// 서버 계속 실행.
//
// false:
// SIGINT/SIGTERM 등이 들어와 종료 진행.
std::atomic<bool> running{true};


// HTTP 서버 socket의 file descriptor.
//
// 아직 생성되지 않았으면 -1.
int server_fd = -1;


// ==============================
// DurationValue
// ==============================
//
// DDS QoS의 시간 값을 표현하기 위한 내부 구조체.
//
// Deadline
// Lifespan
// Liveliness Lease Duration
//
// 등을 공통 형태로 저장한다.
struct DurationValue
{
  // 실제 duration이 존재하면 nanosecond 단위로 저장.
  //
  // 값이 없는 경우 std::nullopt.
  std::optional<int64_t> nanoseconds;

  // DDS duration이 무한대인지 여부.
  bool infinite{false};

  // 이 값을 실제로 관찰할 수 있었는지 여부.
  //
  // 예:
// Reader에는 Lifespan QoS가 없기 때문에
// observed=false로 둘 수 있다.
  bool observed{true};
};


// ==============================
// Endpoint
// ==============================
//
// DDS Discovery에서 발견한 하나의 Reader 또는 Writer를
// Dashboard가 사용하기 쉬운 형태로 정리한 구조체.
//
// 예:
//
// /RobotControl Service Server의
// Request Reader 하나가 Endpoint 하나가 된다.
struct Endpoint
{
  // DDS Endpoint의 고유 GUID.
  std::string guid;

  // 실제 DDS Topic 이름.
  //
  // 예:
  // rq/RobotControlRequest
  // rr/RobotControlReply
  std::string dds_topic;

  // DDS Type 이름.
  std::string dds_type;

  // DDS Topic 이름에서 복원한 ROS2 Service 이름.
  //
  // 예:
  // /RobotControl
  std::string service_name;

  // request 또는 response.
  std::string service_channel;

  // DDS endpoint 종류.
  //
  // reader
  // writer
  std::string endpoint_kind;

  // ROS2 Service 관점에서
  // server인지 client인지.
  std::string service_role;

  // Reliability QoS 문자열.
  //
  // reliable
  // best_effort
  // unknown
  std::string reliability;

  // Durability QoS 문자열.
  std::string durability;

  // Liveliness QoS 문자열.
  std::string liveliness;

  // Deadline QoS.
  DurationValue deadline;

  // Lifespan QoS.
  //
  // Writer에서만 의미가 있으므로
  // Reader의 경우 observed=false로 저장한다.
  DurationValue lifespan;

  // Liveliness Lease Duration.
  DurationValue liveliness_lease_duration;
};


// ==============================
// json_escape()
// ==============================
//
// JSON 문자열 안에 넣을 값을 안전하게 escape한다.
//
// 예:
//
// "
// → \"
//
// 줄바꿈
// → \n
//
// 역슬래시
// → \\
//
// 이 코드에서는 외부 JSON 라이브러리를 쓰지 않고
// 직접 JSON 문자열을 조립하기 때문에 필요한 함수다.
std::string json_escape(const std::string & value)
{
  // 문자열을 조금씩 만들어 담는 stream.
  std::ostringstream output;

  // 입력 문자열의 모든 문자를 하나씩 확인.
  for (const unsigned char character : value) {
    switch (character) {

      // JSON에서 특별한 의미가 있는 문자들은
      // escape 문자로 변환한다.
      case '"':
        output << "\\\"";
        break;

      case '\\':
        output << "\\\\";
        break;

      case '\b':
        output << "\\b";
        break;

      case '\f':
        output << "\\f";
        break;

      case '\n':
        output << "\\n";
        break;

      case '\r':
        output << "\\r";
        break;

      case '\t':
        output << "\\t";
        break;

      default:

        // ASCII control character.
        //
        // JSON 문자열에 그대로 넣지 않고
        // ? 문자로 대체한다.
        if (character < 0x20) {
          output << "?";
        } else {

          // 일반 문자는 그대로 추가.
          output << character;
        }
    }
  }

  // 완성된 문자열 반환.
  return output.str();
}


// ==============================
// quoted()
// ==============================
//
// 문자열을 JSON 문자열 형식으로 만든다.
//
// 예:
//
// hello
// → "hello"
//
// 내부에서 json_escape()도 적용한다.
std::string quoted(const std::string & value)
{
  return "\"" + json_escape(value) + "\"";
}


// ==============================
// duration_value()
// ==============================
//
// Fast DDS Duration_t를
// Dashboard 내부 DurationValue로 변환한다.
DurationValue duration_value(
  const eprosima::fastrtps::Duration_t & duration)
{
  // DDS duration이 infinite인지 확인.
  if (duration.is_infinite()) {

    // nanoseconds 없음
    // infinite=true
    // observed=true
    return {std::nullopt, true, true};
  }

  // 일반 duration이면 nanosecond로 변환.
  return {
    duration.to_ns(),
    false,
    true
  };
}


// ==============================
// duration_json()
// ==============================
//
// DurationValue를 JSON 일부 문자열로 만든다.
//
// 예:
//
// deadline_ns: 1000000000
// deadline_status: observed
//
// 또는:
//
// deadline_ns: null
// deadline_status: infinite
std::string duration_json(
  const char * name,
  const DurationValue & value)
{
  std::ostringstream output;

  // 예:
  // "deadline_ns":
  output << quoted(std::string(name) + "_ns") << ':';

  // 실제 nanosecond 값이 있으면 출력.
  if (value.nanoseconds.has_value()) {
    output << *value.nanoseconds;
  } else {

    // 값이 없으면 JSON null.
    output << "null";
  }

  // 상태 필드 추가.
  //
  // 예:
  // "deadline_status":"observed"
  output
    << ','
    << quoted(std::string(name) + "_status")
    << ':'
    << quoted(
      !value.observed
      ? "unknown"
      : value.infinite
      ? "infinite"
      : "observed"
    );

  return output.str();
}


// ==============================
// reliability_name()
// ==============================
//
// Fast DDS enum 값을
// Frontend/Backend에서 사용하기 쉬운 문자열로 변환.
std::string reliability_name(
  const eprosima::fastrtps::ReliabilityQosPolicyKind kind)
{
  switch (kind) {

    case eprosima::fastrtps::BEST_EFFORT_RELIABILITY_QOS:
      return "best_effort";

    case eprosima::fastrtps::RELIABLE_RELIABILITY_QOS:
      return "reliable";

    default:
      return "unknown";
  }
}


// ==============================
// durability_name()
// ==============================
//
// DDS Durability enum → 문자열.
std::string durability_name(
  const eprosima::fastrtps::DurabilityQosPolicyKind kind)
{
  switch (kind) {

    case eprosima::fastrtps::VOLATILE_DURABILITY_QOS:
      return "volatile";

    case eprosima::fastrtps::TRANSIENT_LOCAL_DURABILITY_QOS:
      return "transient_local";

    case eprosima::fastrtps::TRANSIENT_DURABILITY_QOS:
      return "transient";

    case eprosima::fastrtps::PERSISTENT_DURABILITY_QOS:
      return "persistent";

    default:
      return "unknown";
  }
}


// ==============================
// liveliness_name()
// ==============================
//
// DDS Liveliness enum → 문자열.
std::string liveliness_name(
  const eprosima::fastrtps::LivelinessQosPolicyKind kind)
{
  switch (kind) {

    case eprosima::fastrtps::AUTOMATIC_LIVELINESS_QOS:
      return "automatic";

    case eprosima::fastrtps::MANUAL_BY_PARTICIPANT_LIVELINESS_QOS:
      return "manual_by_participant";

    case eprosima::fastrtps::MANUAL_BY_TOPIC_LIVELINESS_QOS:
      return "manual_by_topic";

    default:
      return "unknown";
  }
}


// ==============================
// service_identity()
// ==============================
//
// DDS Topic 이름을 보고
// ROS2 Service 이름과 request/response 방향을 복원한다.
//
// ROS2 Service는 DDS 내부에서 대략:
//
// rq/<ServiceName>Request
// rr/<ServiceName>Reply
//
// 형태로 보인다.
//
// 예:
//
// rq/RobotControlRequest
//
// → service_name = /RobotControl
// → channel = request
std::optional<std::pair<std::string, std::string>>
service_identity(const std::string & topic)
{
  // Service 이름 후보.
  std::string value;

  // request 또는 response.
  std::string channel;

  // Topic 뒤에서 제거할 접미사.
  std::string suffix;


  // rq/로 시작하면 Service Request channel.
  if (topic.rfind("rq/", 0) == 0) {

    // rq/ 부분 제거.
    value = topic.substr(3);

    channel = "request";

    // ROS2 Service Request DDS Topic의 끝부분.
    suffix = "Request";

  } else if (topic.rfind("rr/", 0) == 0) {

    // rr/로 시작하면 Service Response.
    value = topic.substr(3);

    channel = "response";

    suffix = "Reply";

  } else {

    // ROS2 Service DDS Topic 형식이 아니면
    // 이 observer에서 관심 없는 endpoint.
    return std::nullopt;
  }


  // Topic 끝부분이 Request 또는 Reply인지 검증.
  if (
    value.size() < suffix.size() ||
    value.compare(
      value.size() - suffix.size(),
      suffix.size(),
      suffix
    ) != 0)
  {
    return std::nullopt;
  }


  // 뒤의 Request 또는 Reply 문자열 제거.
  value.erase(value.size() - suffix.size());


  // ROS2 Service 이름이 /로 시작하지 않으면
  // 앞에 / 추가.
  if (value.empty() || value.front() != '/') {
    value.insert(value.begin(), '/');
  }


  // pair:
  //
  // first  = service 이름
  // second = request/response
  return std::make_pair(value, channel);
}


// ==============================
// endpoint_from_proxy()
// ==============================
//
// Fast DDS ReaderProxyData 또는 WriterProxyData를
// Endpoint 구조체로 변환한다.
//
// template을 사용했기 때문에
// Reader와 Writer에 같은 함수 사용 가능.
template<typename ProxyData>
Endpoint endpoint_from_proxy(
  const ProxyData & proxy,
  const char * endpoint_kind)
{
  // Fast DDS GUID를 문자열로 변환.
  std::ostringstream guid;
  guid << proxy.guid();


  // DDS Topic 이름에서
  // ROS2 Service 이름 + request/response 추출.
  //
  // 이 함수가 호출되기 전에 service_identity() 검사를 했기 때문에
  // 여기서는 value()를 바로 사용한다.
  const auto identity =
    service_identity(
      proxy.topicName().to_string()
    ).value();


  // Endpoint 구조체 생성 후 바로 반환.
  return {

    // guid
    guid.str(),

    // DDS Topic 이름
    proxy.topicName().to_string(),

    // DDS Type 이름
    proxy.typeName().to_string(),

    // ROS2 Service 이름
    identity.first,

    // request / response
    identity.second,

    // reader / writer
    endpoint_kind,


    // ==========================
    // Service Client / Server 판별
    // ==========================
    //
    // ROS2 Service Server:
    //
    // Request를 읽음
    // → request reader
    //
    // Response를 씀
    // → response writer
    //
    // 이 두 경우면 server.
    //
    // 그 외:
    //
    // request writer
    // response reader
    //
    // 이므로 client.
    (
      (
        identity.second == "request" &&
        std::string(endpoint_kind) == "reader"
      ) ||
      (
        identity.second == "response" &&
        std::string(endpoint_kind) == "writer"
      )
    )
    ? "server"
    : "client",


    // Reliability
    reliability_name(
      proxy.m_qos.m_reliability.kind
    ),

    // Durability
    durability_name(
      proxy.m_qos.m_durability.kind
    ),

    // Liveliness
    liveliness_name(
      proxy.m_qos.m_liveliness.kind
    ),

    // Deadline
    duration_value(
      proxy.m_qos.m_deadline.period
    ),


    // Lifespan은 DDS Writer QoS.
    //
    // writer면 실제 값 저장.
    //
    // reader면 관찰할 수 없으므로
    // observed=false 상태 저장.
    std::string(endpoint_kind) == "writer"
    ? duration_value(
        proxy.m_qos.m_lifespan.duration
      )
    : DurationValue{
        std::nullopt,
        false,
        false
      },


    // Liveliness Lease Duration
    duration_value(
      proxy.m_qos.m_liveliness.lease_duration
    ),
  };
}


// ==============================
// endpoint_json()
// ==============================
//
// Endpoint 하나를 JSON 문자열로 변환.
//
// 최종 /snapshot 응답의
// endpoints 배열 안에 들어가는 한 항목이다.
std::string endpoint_json(const Endpoint & endpoint)
{
  std::ostringstream output;

  output
    << '{'

    // Endpoint 식별 정보
    << "\"guid\":"
    << quoted(endpoint.guid)
    << ','

    << "\"dds_topic\":"
    << quoted(endpoint.dds_topic)
    << ','

    << "\"dds_type\":"
    << quoted(endpoint.dds_type)
    << ','

    << "\"service_name\":"
    << quoted(endpoint.service_name)
    << ','

    << "\"service_channel\":"
    << quoted(endpoint.service_channel)
    << ','

    << "\"endpoint_kind\":"
    << quoted(endpoint.endpoint_kind)
    << ','

    << "\"service_role\":"
    << quoted(endpoint.service_role)
    << ','


    // ==========================
    // QoS 정보
    // ==========================

    << "\"qos\":{"

    << "\"reliability\":"
    << quoted(endpoint.reliability)
    << ','

    << "\"durability\":"
    << quoted(endpoint.durability)
    << ','


    // 현재 Fast DDS observer에서는
    // History와 Depth를 직접 수집하지 않기 때문에
    // unknown/null 처리.
    << "\"history\":\"unknown\","
    << "\"depth\":null,"


    // Deadline
    << duration_json(
      "deadline",
      endpoint.deadline
    )
    << ','


    // Lifespan
    << duration_json(
      "lifespan",
      endpoint.lifespan
    )
    << ','


    // Liveliness
    << "\"liveliness\":"
    << quoted(endpoint.liveliness)
    << ','


    // Lease duration
    << duration_json(
      "liveliness_lease_duration",
      endpoint.liveliness_lease_duration
    )


    // qos object 종료
    << "}"

    // endpoint object 종료
    << "}";

  return output.str();
}


// ==============================
// DiscoveryListener
// ==============================
//
// Fast DDS Discovery 이벤트를 받는 Listener.
//
// 다른 DDS Participant의 Reader/Writer가:
//
// 생성되거나
// 변경되거나
// 제거될 때
//
// callback을 받아 endpoints_ map을 갱신한다.
class DiscoveryListener
  : public fastdds_dds::DomainParticipantListener
{
public:

  // ============================
  // Subscriber 발견 callback
  // ============================
  //
  // DDS Reader 발견 시 호출.
  void on_subscriber_discovery(
    fastdds_dds::DomainParticipant *,
    rtps::ReaderDiscoveryInfo && info
  ) override
  {
    update_reader(info);
  }


  // ============================
  // Publisher 발견 callback
  // ============================
  //
  // DDS Writer 발견 시 호출.
  void on_publisher_discovery(
    fastdds_dds::DomainParticipant *,
    rtps::WriterDiscoveryInfo && info
  ) override
  {
    update_writer(info);
  }


  // ============================
  // snapshot()
  // ============================
  //
  // 현재 발견되어 있는 모든 Service DDS Endpoint를
  // 하나의 JSON으로 반환한다.
  //
  // Python Monitor가 HTTP GET /snapshot으로 이 값을 가져간다.
  std::string snapshot(int domain_id) const
  {
    // endpoints_ map은 Discovery callback에서도 수정되므로
    // 읽는 동안 mutex lock.
    std::lock_guard<std::mutex> guard(mutex_);

    std::ostringstream output;

    // JSON 시작.
    output
      << "{"
      << "\"available\":true,"
      << "\"source\":\"fastdds_discovery\","
      << "\"domain_id\":"
      << domain_id
      << ","
      << "\"endpoints\":[";


    bool first = true;


    // 현재 저장된 모든 endpoint 순회.
    for (const auto & item : endpoints_) {

      // 첫 항목 이후에는 JSON comma 추가.
      if (!first) {
        output << ',';
      }

      first = false;


      // map item:
      //
      // item.first  = key
      // item.second = Endpoint
      //
      // Endpoint를 JSON으로 변환.
      output << endpoint_json(item.second);
    }


    // endpoints 배열 + 전체 object 닫기.
    output << "]}";

    return output.str();
  }


private:

  // ============================
  // update_reader()
  // ============================
  //
  // DDS Reader discovery 이벤트 처리.
  void update_reader(
    const rtps::ReaderDiscoveryInfo & info)
  {
    // 이 Reader의 DDS Topic이
    // ROS2 Service 형태인지 확인.
    const auto identity =
      service_identity(
        info.info.topicName().to_string()
      );


    // Service가 아니면 관심 없음.
    if (!identity.has_value()) {
      return;
    }


    // reader GUID를 기반으로
    // map key 생성.
    const std::string key =
      guid_key(
        info.info.guid(),
        "reader"
      );


    // endpoints_ 수정 전에 lock.
    std::lock_guard<std::mutex> guard(mutex_);


    // Reader가 DDS에서 제거된 이벤트라면
    // map에서도 삭제.
    if (
      info.status ==
      rtps::ReaderDiscoveryInfo::REMOVED_READER
    ) {
      endpoints_.erase(key);

    } else {

      // 새 Reader 또는 업데이트된 Reader라면
      // Endpoint 구조체로 변환해 저장.
      endpoints_[key] =
        endpoint_from_proxy(
          info.info,
          "reader"
        );
    }
  }


  // ============================
  // update_writer()
  // ============================
  //
  // DDS Writer discovery 이벤트 처리.
  void update_writer(
    const rtps::WriterDiscoveryInfo & info)
  {
    // ROS2 Service DDS Topic인지 확인.
    const auto identity =
      service_identity(
        info.info.topicName().to_string()
      );


    if (!identity.has_value()) {
      return;
    }


    // writer GUID 기반 key 생성.
    const std::string key =
      guid_key(
        info.info.guid(),
        "writer"
      );


    // map 수정 lock.
    std::lock_guard<std::mutex> guard(mutex_);


    // Writer 제거 이벤트.
    if (
      info.status ==
      rtps::WriterDiscoveryInfo::REMOVED_WRITER
    ) {
      endpoints_.erase(key);

    } else {

      // Writer 생성/갱신.
      endpoints_[key] =
        endpoint_from_proxy(
          info.info,
          "writer"
        );
    }
  }


  // ============================
  // guid_key()
  // ============================
  //
  // GUID만 사용하면
  // Reader/Writer 구분이 명확하지 않을 수 있으므로
  //
  // "reader:<guid>"
  // "writer:<guid>"
  //
  // 형태의 map key를 만든다.
  template<typename Guid>
  static std::string guid_key(
    const Guid & guid,
    const char * kind)
  {
    std::ostringstream output;

    output
      << kind
      << ':'
      << guid;

    return output.str();
  }


  // snapshot()과 discovery callback이
  // 동시에 endpoints_에 접근할 수 있기 때문에
  // mutex 필요.
  mutable std::mutex mutex_;


  // 현재 발견된 Service DDS endpoint 저장소.
  //
  // key:
  // reader:<GUID>
  // writer:<GUID>
  //
  // value:
  // Endpoint 정보
  std::map<std::string, Endpoint> endpoints_;
};


// ==============================
// environment_integer()
// ==============================
//
// 환경변수에서 정수 값을 읽는다.
//
// 예:
//
// ROS_DOMAIN_ID
// ROS2_DDS_QOS_OBSERVER_PORT
//
// 값이 없거나 숫자가 아니거나 범위를 벗어나면
// fallback을 사용한다.
int environment_integer(
  const char * name,
  int fallback,
  int minimum,
  int maximum)
{
  // 환경변수 읽기.
  const char * raw = std::getenv(name);


  // 환경변수가 존재하지 않으면 기본값.
  if (raw == nullptr) {
    return fallback;
  }


  try {
    // 문자열 → int 변환.
    const int value = std::stoi(raw);


    // 허용 범위 안이면 사용.
    //
    // 아니면 fallback.
    return
      value >= minimum &&
      value <= maximum
      ? value
      : fallback;

  } catch (...) {

    // 숫자 변환 실패 등
    // 모든 예외는 fallback.
    return fallback;
  }
}


// ==============================
// stop()
// ==============================
//
// SIGINT 또는 SIGTERM 발생 시 호출.
//
// 예:
//
// Ctrl+C
// systemctl stop
//
// 실행 loop를 끝내고
// accept()가 block되어 있으면 shutdown으로 깨운다.
void stop(
  [[maybe_unused]] int signal_number)
{
  // 메인 server loop 종료 요청.
  running = false;


  // 서버 socket이 살아 있으면 shutdown.
  //
  // accept()가 대기 중이어도 빠져나올 수 있게 한다.
  if (server_fd >= 0) {
    shutdown(
      server_fd,
      SHUT_RDWR
    );
  }
}


// ==============================
// send_all()
// ==============================
//
// send()는 한 번 호출한다고
// 전체 문자열이 무조건 전송된다는 보장이 없다.
//
// 따라서 response 전체가 전송될 때까지
// 반복해서 send()한다.
bool send_all(
  int client,
  const std::string & response)
{
  // 지금까지 전송한 byte 수.
  std::size_t sent = 0;


  // 전체 response가 전송될 때까지 반복.
  while (sent < response.size()) {

    const auto count = send(
      client,
      response.data() + sent,
      response.size() - sent,
      0
    );


    // send 실패 또는 연결 종료.
    if (count <= 0) {
      return false;
    }


    // 실제 보낸 byte만큼 증가.
    sent += static_cast<std::size_t>(count);
  }


  return true;
}


// ==============================
// serve()
// ==============================
//
// Fast DDS observer 내부의 아주 단순한 HTTP 서버.
//
// 제공 API:
//
// GET /health
// GET /snapshot
//
// localhost에서만 열기 때문에
// 외부에서 직접 접근하지 않는다.
int serve(
  DiscoveryListener & listener,
  int domain_id,
  uint16_t port)
{
  // ============================
  // TCP socket 생성
  // ============================

  server_fd = socket(
    AF_INET,
    SOCK_STREAM,
    0
  );


  // socket 생성 실패.
  if (server_fd < 0) {
    return 1;
  }


  // 같은 주소/포트를 재시작 시
  // 빠르게 다시 bind할 수 있도록 설정.
  int reuse = 1;

  setsockopt(
    server_fd,
    SOL_SOCKET,
    SO_REUSEADDR,
    &reuse,
    sizeof(reuse)
  );


  // IPv4 주소 구조체.
  sockaddr_in address{};


  // IPv4.
  address.sin_family = AF_INET;


  // host byte order → network byte order.
  address.sin_port = htons(port);


  // localhost 127.0.0.1 문자열을
  // binary IPv4 주소로 변환.
  inet_pton(
    AF_INET,
    "127.0.0.1",
    &address.sin_addr
  );


  // ============================
  // bind + listen
  // ============================

  // 지정 포트에 socket 연결.
  //
  // 이후 최대 8개 연결을 queue에서 대기.
  if (
    bind(
      server_fd,
      reinterpret_cast<sockaddr *>(&address),
      sizeof(address)
    ) < 0 ||
    listen(
      server_fd,
      8
    ) < 0
  ) {
    close(server_fd);

    server_fd = -1;

    return 1;
  }


  // observer 서버가 정상적으로 열렸음을 로그로 출력.
  std::cerr
    << "Fast DDS QoS observer listening on 127.0.0.1:"
    << port
    << " domain "
    << domain_id
    << std::endl;


  // ============================
  // HTTP 요청 처리 loop
  // ============================

  while (running) {

    // 새로운 TCP 연결 기다림.
    //
    // blocking 함수.
    const int client =
      accept(
        server_fd,
        nullptr,
        nullptr
      );


    // accept 실패.
    //
    // signal 때문에 깨어난 경우도 있으므로
    // 다시 loop.
    if (client < 0) {
      continue;
    }


    // 요청을 받을 버퍼.
    char request[1024]{};


    // HTTP request 수신.
    const auto received =
      recv(
        client,
        request,
        sizeof(request) - 1,
        0
      );


    // 실제 받은 데이터가 있으면 string으로 변환.
    //
    // 실패하면 빈 문자열.
    const std::string request_text =
      received > 0
      ? std::string(request, received)
      : "";


    // ============================
    // GET /health
    // ============================

    const bool health =
      request_text.rfind(
        "GET /health ",
        0
      ) == 0;


    // ============================
    // GET /snapshot
    // ============================

    const bool snapshot =
      request_text.rfind(
        "GET /snapshot ",
        0
      ) == 0;


    // health 요청이면 간단한 상태 반환.
    //
    // 그 외에는 listener snapshot 생성.
    //
    // 실제 status code는 아래에서 결정하므로
    // 잘못된 URL이어도 여기서는 snapshot body가 만들어질 수 있다.
    const std::string body =
      health
      ? "{\"status\":\"ok\"}"
      : listener.snapshot(domain_id);


    // /health 또는 /snapshot이면 200.
    //
    // 그 외 경로는 404.
    const std::string status =
      (health || snapshot)
      ? "200 OK"
      : "404 Not Found";


    // ============================
    // HTTP response 직접 조립
    // ============================

    const std::string response =
      "HTTP/1.1 " +
      status +
      "\r\n"
      "Content-Type: application/json\r\n" +
      "Content-Length: " +
      std::to_string(body.size()) +
      "\r\n"
      "Connection: close\r\n"
      "\r\n" +
      body;


    // 전체 response 전송.
    send_all(
      client,
      response
    );


    // 요청 하나 처리 후 연결 종료.
    close(client);
  }


  // ============================
  // 서버 종료 cleanup
  // ============================

  if (server_fd >= 0) {

    close(server_fd);

    server_fd = -1;
  }


  return 0;
}


// 이름 없는 namespace 종료.
}  // namespace


// ==============================
// main()
// ==============================
//
// 프로그램 시작점.
//
// 전체 흐름:
//
// 1. signal handler 등록
// 2. ROS_DOMAIN_ID / port 읽기
// 3. Fast DDS Participant 생성
// 4. Discovery Listener 등록
// 5. localhost HTTP server 실행
// 6. 종료 시 Participant 삭제
int main()
{
  // ============================
  // 종료 signal 등록
  // ============================

  // Ctrl+C.
  std::signal(
    SIGINT,
    stop
  );


  // systemctl stop 등.
  std::signal(
    SIGTERM,
    stop
  );


  // ============================
  // ROS Domain ID 읽기
  // ============================
  //
  // 환경변수:
  // ROS_DOMAIN_ID
  //
  // 없으면 0.
  //
  // 허용 범위:
  // 0 ~ 232
  const int domain_id =
    environment_integer(
      "ROS_DOMAIN_ID",
      0,
      0,
      232
    );


  // ============================
  // Observer HTTP Port 읽기
  // ============================
  //
  // 환경변수:
  // ROS2_DDS_QOS_OBSERVER_PORT
  //
  // 없으면 8766.
  const int configured_port =
    environment_integer(
      "ROS2_DDS_QOS_OBSERVER_PORT",
      kDefaultPort,
      1,
      65535
    );


  // ============================
  // Discovery Listener 생성
  // ============================

  DiscoveryListener listener;


  // 기본 Fast DDS Participant QoS 가져오기.
  auto qos =
    fastdds_dds::PARTICIPANT_QOS_DEFAULT;


  // Participant 이름 지정.
  //
  // DDS discovery에서 이 observer 자체를
  // 식별하는 데 사용할 수 있다.
  qos.name(
    "ros2_dashboard_fastdds_qos_observer"
  );


  // DomainParticipantFactory singleton 가져오기.
  auto * factory =
    fastdds_dds::DomainParticipantFactory::
    get_instance();


  // ============================
  // Fast DDS Participant 생성
  // ============================
  //
  // 이 Participant가 ROS_DOMAIN_ID에 참가해서
  // 같은 DDS Domain의 Reader/Writer discovery 이벤트를 받는다.
  auto * participant =
    factory->create_participant(
      domain_id,
      qos,
      &listener,
      fastdds_dds::StatusMask::all()
    );


  // Participant 생성 실패.
  if (participant == nullptr) {

    std::cerr
      << "Failed to create Fast DDS observer participant"
      << std::endl;

    return 1;
  }


  // ============================
  // HTTP 서버 실행
  // ============================
  //
  // listener가 모은 DDS endpoint snapshot을
  // localhost:8766으로 제공.
  const int result =
    serve(
      listener,
      domain_id,
      static_cast<uint16_t>(
        configured_port
      )
    );


  // ============================
  // Fast DDS Participant 정리
  // ============================

  factory->delete_participant(
    participant
  );


  // serve() 결과를 프로그램 종료 코드로 반환.
  return result;
}