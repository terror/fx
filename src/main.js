const vert = `
#version 300 es

in vec4 position;

void main() {
  gl_Position = position;
}
`;

const frag = `
#version 300 es

precision highp float;

out vec4 color;
uniform sampler2D source;
uniform bool invert;

void main() {
  vec3 pixel = texture(source, gl_FragCoord.xy / 1000.0).rgb;
  if (invert) {
    color = vec4(vec3(1, 1, 1) - pixel, 1.0);
  } else {
    color = vec4(pixel, 1.0);
  }
}
`;

class Computer {
  constructor() {
    // The WebGL canvas context
    this.gl = document.getElementById('canvas').getContext('webgl2');

    if (!this.gl) {
      throw 'Failed to initialize WebGL context';
    }

    // The WebGL program composed of two shaders
    this.program = this.createProgram([
      { text: vert, type: this.gl.VERTEX_SHADER },
      { text: frag, type: this.gl.FRAGMENT_SHADER },
    ]);

    // Length of our triangle indices array used for drawing
    this.length = this.setupTriangles();

    // Index of the source texture
    this.source = 0;

    // Textures we use for each `apply`
    this.textures = new Array(2).fill(null).map(() => this.createTexture());

    // The current mask
    this.mask = this.getUniform('all');

    // The current operation
    this.operation = this.getUniform('invert');

    // The frame buffer that holds our textures
    this.frameBuffer = this.gl.createFramebuffer();
  }

  run(input) {
    input.split(' ').forEach((token) => {
      switch (token) {
        case 'apply':
          this.render();
          break;
        default:
          throw `Failed to compile program: ${input[0]}`;
      }
    });

    this.drawToCanvas();
  }

  render() {
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

    this.setUniform(this.mask, 1);
    this.setUniform(this.operation, 1);

    gl.drawArrays(gl.TRIANGLES, 0, this.length);

    this.source ^= 1;
  }

  getUniform(name) {
    return this.gl.getUniformLocation(this.program, name);
  }

  setUniform(uniform, value) {
    this.gl.uniform1i(uniform, value);
  }

  createShader(code) {
    const gl = this.gl;

    const shader = gl.createShader(code.type);

    gl.shaderSource(shader, code.text.trim());
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw gl.getShaderInfoLog(shader);
    }

    return shader;
  }

  createTexture() {
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

  createProgram(code) {
    const gl = this.gl;

    const program = gl.createProgram();

    code
      .map((item) => this.createShader(item))
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

  drawToCanvas() {
    const gl = this.gl;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, this.textures[this.source]);

    this.setUniform(this.mask, 0);
    this.setUniform(this.operation, 0);

    gl.drawArrays(gl.TRIANGLES, 0, this.length);
  }

  setupTriangles() {
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
