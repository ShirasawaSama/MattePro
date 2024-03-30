cmake_minimum_required(VERSION 3.24)

project(MattePro LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)

add_subdirectory(simpleocv)

file(GLOB_RECURSE SOURCES "lib/*.cpp" "lib/*.h" "lib/**/*.cpp" "lib/**/*.h")

#add_executable(MattePro ${SOURCES})
include_directories(onnxruntime-osx-arm64-static_lib-1.17.1/include simpleocv/include)

add_library(MattePro SHARED ${SOURCES})
set_target_properties(MattePro PROPERTIES PREFIX "")
set_target_properties(MattePro PROPERTIES SUFFIX ".uxpaddon")

if(MSVC)
    target_compile_options(MattePro PRIVATE
            $<$<CONFIG:Release>:/MT>
            $<$<CONFIG:Debug>:/MTd>
    )
else()
    # faster build only for relase
    target_compile_options(MattePro PRIVATE
            $<$<CONFIG:Release>:-O3 -ffast-math -ftree-vectorize>
    )
endif()

target_link_libraries(MattePro PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}/onnxruntime-osx-arm64-static_lib-1.17.1/lib/libonnxruntime.a" simpleocv "-framework Foundation")

#file(COPY ${CMAKE_BINARY_DIR}/OmokageLib.uxpaddon DESTINATION /Users/shirasawa/code/Hanamachi-PS/shirasawa.hanamachi/dist/mac/arm64/)
