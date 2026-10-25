cmake_minimum_required(VERSION 3.24)
project(CafeGame VERSION 0.1.0 LANGUAGES C CXX)
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
if(NOT EMSCRIPTEN)
  message(FATAL_ERROR "CafeGame uses WebEngine's browser runtime. Configure with emcmake cmake.")
endif()

include(FetchContent)
set(WEBENGINE_SOURCE_DIR "" CACHE PATH "Optional WebEngine checkout; otherwise fetch the pinned revision")
if(WEBENGINE_SOURCE_DIR)
  add_subdirectory("${WEBENGINE_SOURCE_DIR}" webengine EXCLUDE_FROM_ALL)
else()
  FetchContent_Declare(webengine
    GIT_REPOSITORY https://github.com/johdav999/WebEngine.git
    GIT_TAG 56080eca124c9a62e15b146799a8004bdad5a9b2)
  FetchContent_GetProperties(webengine)
  if(NOT webengine_POPULATED)
    FetchContent_Populate(webengine)
  endif()
  add_subdirectory("${webengine_SOURCE_DIR}" webengine EXCLUDE_FROM_ALL)
endif()
if(NOT TARGET WebEngine::Browser)
  message(FATAL_ERROR "WebEngine checkout must provide WebEngine::Browser; use the pinned revision.")
endif()

add_executable(cafe_game src/browser_main.cpp src/cafe_scene.cpp)
target_include_directories(cafe_game PRIVATE src)
target_link_libraries(cafe_game PRIVATE WebEngine::Browser engine_audio_browser engine_assets_browser)
target_compile_options(cafe_game PRIVATE -Wall -Wextra -Wpedantic -fexceptions)
target_link_options(cafe_game PRIVATE
  -sALLOW_MEMORY_GROWTH=1 -sSTACK_SIZE=2097152 -sENVIRONMENT=web
  -sEXIT_RUNTIME=0 -sFILESYSTEM=0
  "-sEXPORTED_FUNCTIONS=['_main','_cafe_command','_cafe_suspend','_cafe_shutdown']")
set_target_properties(cafe_game PROPERTIES SUFFIX ".js"
  RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/site")
add_custom_command(TARGET cafe_game POST_BUILD
  COMMAND ${CMAKE_COMMAND} -E copy_directory "${CMAKE_SOURCE_DIR}/web" "${CMAKE_BINARY_DIR}/site"
  COMMAND ${CMAKE_COMMAND} -E copy_directory "${CMAKE_SOURCE_DIR}/assets" "${CMAKE_BINARY_DIR}/site/assets"
  COMMAND ${CMAKE_COMMAND} -E copy_if_different "$<TARGET_FILE:asset_decode_worker>" "${CMAKE_BINARY_DIR}/site/asset_decode.js"
  COMMAND ${CMAKE_COMMAND} -E copy_if_different "$<TARGET_FILE_DIR:asset_decode_worker>/asset_decode.wasm" "${CMAKE_BINARY_DIR}/site/asset_decode.wasm")
get_target_property(_engine_source engine_core SOURCE_DIR)
foreach(_license IN ITEMS
    "third_party/cgltf/LICENSE" "third_party/ufbx/LICENSE"
    "third_party/stb/LICENSE" "third_party/meshoptimizer/LICENSE.md")
  get_filename_component(_library "${_license}" DIRECTORY)
  get_filename_component(_library "${_library}" NAME)
  add_custom_command(TARGET cafe_game POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E make_directory "${CMAKE_BINARY_DIR}/site/licenses"
    COMMAND ${CMAKE_COMMAND} -E copy_if_different "${_engine_source}/${_license}"
      "${CMAKE_BINARY_DIR}/site/licenses/${_library}.txt")
endforeach()
get_target_property(_jolt_source Jolt SOURCE_DIR)
add_custom_command(TARGET cafe_game POST_BUILD
  COMMAND ${CMAKE_COMMAND} -E copy_if_different "${_jolt_source}/../LICENSE"
    "${CMAKE_BINARY_DIR}/site/licenses/Jolt.txt")
