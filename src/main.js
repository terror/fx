const vert = `
#version 300 es

in vec4 position;
out vec2 uv;

void main() {
  // 0 -> 1
  uv = position.xy * 0.5 + 0.5;
  gl_Position = position;
}
`;

const frag = `
#version 300 es

precision highp float;

in vec2 uv;
out vec4 color;

uniform sampler2D source;

#define I texture(source, uv)

// operations
uniform bool invert;
uniform bool invert_b;
uniform bool invert_g;
uniform bool invert_r;

// masks
uniform bool bottom;
uniform bool circle;
uniform bool cross;
uniform bool left;
uniform bool right;
uniform bool square;
uniform bool top;
uniform bool x;

vec4 operation() {
  if (invert) return vec4(1.0 - I.rgb, 1.0);
  if (invert_b) return vec4(I.rg, 1.0 - I.b, 1.0);
  if (invert_g) return vec4(I.r, 1.0 - I.g, I.b, 1.0);
  if (invert_r) return vec4(1.0 - I.r, I.gb, 1.0);
  return I;
}

bool is_masked() {
  if (bottom) return uv.y > 0.5;
  if (circle) length((uv - 0.5) * 2.0) < 0.5;
  if (cross) return abs(uv.x - 0.5) < 0.1 || abs(uv.y - 0.5) < 0.1;
  if (left) return uv.x < 0.5;
  if (right) return uv.x > 0.5;
  if (square) return abs(uv.x - 0.5) < 0.25 && abs(uv.y - 0.5) < 0.25;
  if (top) return uv.y < 0.5;
  if (x) return min(abs((1.0 - uv.x) - uv.y), abs(uv.x - uv.y)) < 0.1;
  return true;
}

void main() {
  color = is_masked() ? operation() : I;
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

    // Set the canvas to black
    this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    // Resize the canvas to match the size its displayed
    webglUtils.resizeCanvasToDisplaySize(this.gl.canvas);

    // Tell WebGL how to convert from clip space to pixels
    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);

    // The WebGL program composed of two shaders
    this.program = this.#createProgram([
      { text: vert, type: this.gl.VERTEX_SHADER },
      { text: frag, type: this.gl.FRAGMENT_SHADER },
    ]);

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
    const gl = this.gl;

    input.split(' ').forEach((token) => {
      switch (token) {
        case 'all':
        case 'bottom':
        case 'circle':
        case 'cross':
        case 'left':
        case 'right':
        case 'square':
        case 'top':
        case 'x':
          gl.uniform1i(this.mask, 0);
          this.mask = gl.getUniformLocation(this.program, token);
          break;
        case 'invert':
        case 'invert-b':
        case 'invert-g':
        case 'invert-r':
          gl.uniform1i(this.operation, 0);
          this.operation = gl.getUniformLocation(
            this.program,
            token.replace('-', '_')
          );
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
   * Render the destination texture onto the canvas.
   */
  #renderToCanvas() {
    const gl = this.gl;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, this.textures[this.source]);

    // Unset the current mask and operation
    // this.gl.uniform1i(this.mask, 0);
    // this.gl.uniform1i(this.operation, 0);

    gl.drawArrays(gl.TRIANGLES, 0, this.length);
  }

  /**
   * Render to a destination texture using the texture at `source` as input.
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
   * @returns {object} - The newly created shader object
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
   * @returns {object} - The newly created texture object
   */
  #createTexture() {
    const gl = this.gl;

    const texture = gl.createTexture();

    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.canvas.width,
      gl.canvas.height,
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
   * Create a program given an array of objects.
   * @param {Array} - An array of objects where `text` is the code and `type` is the shader type
   * @returns {object} - The newly created program object
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
   * @returns {float} - The number of vertices in the `vertices` array
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
