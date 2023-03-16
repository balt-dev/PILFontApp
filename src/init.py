import sdl2


def init_context(name: str, width: int, height: int):
    """
    Boilerplate code to initiaize a SDL2 context.
    Taken from https://github.com/pyimgui/pyimgui/blob/master/doc/examples/integrations_pysdl2.py
    """
    window_name = name.encode("utf-8", "ignore")

    if sdl2.SDL_Init(sdl2.SDL_INIT_EVERYTHING) < 0:
        print("Error: SDL could not initialize! SDL Error: " + sdl2.SDL_GetError().decode("utf-8"))
        exit(1)

    sdl2.SDL_GL_SetAttribute(sdl2.SDL_GL_DOUBLEBUFFER, 1)
    sdl2.SDL_GL_SetAttribute(sdl2.SDL_GL_DEPTH_SIZE, 24)
    sdl2.SDL_GL_SetAttribute(sdl2.SDL_GL_STENCIL_SIZE, 8)
    sdl2.SDL_GL_SetAttribute(sdl2.SDL_GL_ACCELERATED_VISUAL, 1)
    sdl2.SDL_GL_SetAttribute(sdl2.SDL_GL_MULTISAMPLEBUFFERS, 1)
    sdl2.SDL_GL_SetAttribute(sdl2.SDL_GL_MULTISAMPLESAMPLES, 16)
    sdl2.SDL_GL_SetAttribute(sdl2.SDL_GL_CONTEXT_FLAGS, sdl2.SDL_GL_CONTEXT_FORWARD_COMPATIBLE_FLAG)
    sdl2.SDL_GL_SetAttribute(sdl2.SDL_GL_CONTEXT_MAJOR_VERSION, 4)
    sdl2.SDL_GL_SetAttribute(sdl2.SDL_GL_CONTEXT_MINOR_VERSION, 1)
    sdl2.SDL_GL_SetAttribute(sdl2.SDL_GL_CONTEXT_PROFILE_MASK, sdl2.SDL_GL_CONTEXT_PROFILE_CORE)

    sdl2.SDL_SetHint(sdl2.SDL_HINT_MAC_CTRL_CLICK_EMULATE_RIGHT_CLICK, b"1")
    sdl2.SDL_SetHint(sdl2.SDL_HINT_VIDEO_HIGHDPI_DISABLED, b"1")

    if (window := sdl2.SDL_CreateWindow(
            window_name,
            sdl2.SDL_WINDOWPOS_CENTERED, sdl2.SDL_WINDOWPOS_CENTERED,
            width, height,
            sdl2.SDL_WINDOW_OPENGL | sdl2.SDL_WINDOW_RESIZABLE)
    ) is None:
        print("Error: Window could not be created! SDL Error: " + sdl2.SDL_GetError().decode("utf-8"))
        exit(1)

    if (gl_context := sdl2.SDL_GL_CreateContext(window)) is None:
        print("Error: Cannot create OpenGL Context! SDL Error: " + sdl2.SDL_GetError().decode("utf-8"))
        exit(1)

    sdl2.SDL_GL_MakeCurrent(window, gl_context)
    if sdl2.SDL_GL_SetSwapInterval(1) < 0:
        print("Warning: Unable to set VSync! SDL Error: " + sdl2.SDL_GetError().decode("utf-8"))

    return window, gl_context
