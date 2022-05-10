const vert = `
#version 300 es

in vec4 position;
uniform vec2 resolution;

void main() {
  // vec2 zeroToOne = position.xy / resolution;
  // vec2 zeroToTwo = zeroToOne * 2.0;
  // vec2 clipSpace = zeroToTwo - 1.0;
  // gl_Position = vec4(clipSpace, 0, 1);
  gl_Position = position;
}
`;

const frag = `
#version 300 es

precision highp float;

out vec4 color;

uniform sampler2D source;

// operations
uniform bool invert;

// masks
uniform bool circle;
uniform bool cross;
uniform bool square;
uniform bool top;
uniform bool x;

vec4 operation(vec4 pixel) {
  if (invert)
    return vec4(1.0 - pixel.rgb, 1.0);
  return pixel;
}

bool is_masked(vec2 coords) {
  if (circle)
    return true;
  if (cross)
    return true;
  if (square)
    return true;
  if (top)
    return coords.y < 0.0;
  if (x)
    return abs(coords.x - coords.y) < 0.25 || abs(coords.x + coords.y) < 0.25;
  return true;
}

void main() {
  vec4 pixel = texture(source, gl_FragCoord.xy / 512.0);
  color = is_masked(gl_FragCoord.xy / 512.0) ? operation(pixel) : pixel;
}
`;

const DEFAULT_MASK = 'all';
const DEFAULT_OPERATION = 'invert';

class Computer {
  constructor() {
    // The WebGL canvas context
    this.gl = document.getElementById('canvas').getContext('webgl2');

    // Throw if we can't initialize WebGL
    if (!this.gl) {
      throw 'Failed to initialize WebGL context';
    }

    // The WebGL program composed of two shaders
    this.program = this.#createProgram([
      { text: vert, type: this.gl.VERTEX_SHADER },
      { text: frag, type: this.gl.FRAGMENT_SHADER },
    ]);

    // Number of pixels == size it's displayed
    webglUtils.resizeCanvasToDisplaySize(this.gl.canvas);

    // Tell WebGL how to convert from clip space to pixels
    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);

    // Set the resolution
    this.gl.uniform2f(
      this.gl.getUniformLocation(this.program, 'resolution'),
      this.gl.canvas.width,
      this.gl.canvas.height
    );

    // Length of our triangle indices array used for drawing
    this.length = this.#setupTriangles();

    // Index of the source texture
    this.source = 0;

    // Textures we use for each `apply`
    this.textures = new Array(2).fill(null).map(() => this.#createTexture());

    // The current mask
    this.mask = this.gl.getUniformLocation(this.program, DEFAULT_MASK);

    // The current operation
    this.operation = this.gl.getUniformLocation(
      this.program,
      DEFAULT_OPERATION
    );

    // The frame buffer that holds our textures
    this.frameBuffer = this.gl.createFramebuffer();
  }

  /**
   * Handle the current program typed in by the user.
   * @param {string} input - The current program state
   */
  run(input) {
    input.split(' ').forEach((token) => {
      switch (token) {
        case 'circle':
        case 'cross':
        case 'square':
        case 'top':
        case 'x':
          this.mask = this.gl.getUniformLocation(this.program, token);
          break;
        case 'apply':
          this.#renderToTexture();
          break;
        default:
          throw `Failed to compile program: ${input[0]}`;
      }
    });

    this.#renderToCanvas();
  }

  /**
   * Draw the destination texture onto the canvas.
   */
  #renderToCanvas() {
    const gl = this.gl;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, this.textures[this.source]);

    // Unset the current mask and operation
    this.gl.uniform1i(this.mask, 0);
    this.gl.uniform1i(this.operation, 0);

    gl.drawArrays(gl.TRIANGLES, 0, this.length);
  }

  /**
   * Draw to a destination texture using the texture at `source` as input.
   */
  #renderToTexture() {
    const gl = this.gl;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.frameBuffer);

    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.textures[this.source ^ 1],
      0
    );

    gl.bindTexture(gl.TEXTURE_2D, this.textures[this.source]);

    // Set the current mask and operation
    this.gl.uniform1i(this.mask, 1);
    this.gl.uniform1i(this.operation, 1);

    gl.drawArrays(gl.TRIANGLES, 0, this.length);

    this.source ^= 1;
  }

  /**
   * Create a shader given its code and type.
   * @param {object} - where `text` is the code and `type` is the shader type
   */
  #createShader(code) {
    const gl = this.gl;

    const shader = gl.createShader(code.type);

    gl.shaderSource(shader, code.text.trim());
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw gl.getShaderInfoLog(shader);
    }

    return shader;
  }

  /**
   * Create a new texture with pre-set configuration options.
   */
  #createTexture() {
    const gl = this.gl;

    const texture = gl.createTexture();

    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      256,
      256,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    return texture;
  }

  /**
   * Create a program given a list of objects
   * @param {Array} - A list of objects where `text` is the code and `type` is the shader type
   */
  #createProgram(code) {
    const gl = this.gl;

    const program = gl.createProgram();

    code
      .map((item) => this.#createShader(item))
      .forEach((shader) => {
        gl.attachShader(program, shader);
      });

    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw gl.getProgramInfoLog(program);
    }

    gl.useProgram(program);

    return program;
  }

  /**
   * Setup full screen rendering using two triangles.
   */
  #setupTriangles() {
    const gl = this.gl;

    const vertices = new Float32Array(
      [
        [-1, -1, 0],
        [1, -1, 0],
        [1, 1, 0],
        [1, 1, 0],
        [-1, 1, 0],
        [-1, -1, 0],
      ].flat()
    );

    const position = gl.getAttribLocation(this.program, 'position');

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 0, 0);

    return vertices.length / 3;
  }
}

/**
 * Program entrypoint.
 */
const main = () => {
  try {
    const computer = new Computer();
    const editor = CodeMirror.fromTextArea(document.getElementById('program'), {
      lineNumbers: true,
      tabSize: 2,
    });
    editor.on('changes', () => computer.run(editor.getValue()));
    editor.save();
  } catch (error) {
    console.error(`error: ${error}`);
  }
};

main();
