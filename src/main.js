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
    this.gl = document.getElementById('canvas').getContext('webgl2');

    if (!this.gl) {
      throw 'Failed to initialize WebGL context';
    }

    this.program = this.createProgram([
      { code: vert, type: 'vertex' },
      { code: frag, type: 'fragment' },
    ]);

    this.length = this.setupTriangles();
    this.source = 0;
    this.textures = new Array(2).fill(null).map(() => this.createTexture());
    this.textureLocation = this.gl.getUniformLocation(this.program, 'source');
    this.gl.uniform1i(this.textureLocation, 0);
    this.frameBuffer = this.gl.createFramebuffer();
  }

  run(e) {
    const input = e.target.value;

    input.split(' ').forEach((token) => {
      switch (token) {
        case 'apply':
          this.apply(() =>
            this.gl.uniform1i(
              this.gl.getUniformLocation(this.program, 'invert'),
              1
            )
          );
          break;
        default:
          throw `Failed to compile program: ${input[0]}`;
      }
    });

    this.drawToCanvas();
  }

  apply(mask) {
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
    mask();
    gl.drawArrays(gl.TRIANGLES, 0, this.length);

    this.source ^= 1;
  }

  createShader(item) {
    const gl = this.gl;

    const shader = gl.createShader(
      item.type === 'vertex' ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER
    );

    gl.shaderSource(shader, item.code.trim());
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
    gl.uniform1i(gl.getUniformLocation(this.program, 'invert'), 0);
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
    document
      .getElementById('program')
      .addEventListener('input', (e) => computer.run(e));
  } catch (error) {
    console.error(`error: ${error}`);
  }
};

main();
