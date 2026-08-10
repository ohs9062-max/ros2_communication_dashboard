cmake_minimum_required(VERSION 3.8)
project(ros2_dashboard_dds_observer)

if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
  add_compile_options(-Wall -Wextra -Wpedantic)
endif()

find_package(ament_cmake REQUIRED)
find_package(fastrtps REQUIRED)

add_executable(fastdds_qos_observer src/fastdds_qos_observer.cpp)
target_compile_features(fastdds_qos_observer PUBLIC cxx_std_17)
target_link_libraries(fastdds_qos_observer fastrtps)

install(TARGETS fastdds_qos_observer DESTINATION lib/${PROJECT_NAME})

if(BUILD_TESTING)
  find_package(ament_lint_auto REQUIRED)
  ament_lint_auto_find_test_dependencies()
endif()

ament_package()
