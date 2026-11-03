# Compatibility fix for the pinned WebEngine browser adapter. Creating an
# AudioContext during activation must not first enqueue an explicit suspend:
# Chromium can leave the immediately following resume pending indefinitely.
file(READ "${INPUT}" audio)
foreach(fragment IN ITEMS "getContext() {" "const context=this.getContext();" "void context.suspend().catch")
  string(FIND "${audio}" "${fragment}" found)
  if(found EQUAL -1)
    message(FATAL_ERROR "Engine audio adapter changed; review the activation compatibility patch")
  endif()
endforeach()
string(REPLACE "getContext() {" "getContext(activating=false) {" audio "${audio}")
string(REPLACE "void context.suspend().catch" "if(!activating) void context.suspend().catch" audio "${audio}")
# Only activate() has this standalone declaration; start() continues to use the
# default, suspended creation path. No autoplay or pause behavior is bypassed.
string(REPLACE "const context=this.getContext();\n      Promise.resolve(context.resume())" "const context=this.getContext(true);\n      Promise.resolve(context.resume())" patched "${audio}")
if(patched STREQUAL audio)
  message(FATAL_ERROR "Engine audio activation changed; review the compatibility patch")
endif()
file(WRITE "${OUTPUT}" "${patched}")
