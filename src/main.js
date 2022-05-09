const vertexCode = `
#version 300 es

in vec4 position;

void main() {
  gl_Position = position;
}
`;

const fragmentCode = `
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

const canvas = document.getElementById('canvas');

// canvas.width = canvas.clientWidth * window.devicePixelRatio;
// canvas.height = canvas.clientHeight * window.devicePixelRatio;

const gl = canvas.getContext('webgl2');

if (!gl) {
  throw 'Unable to initialize WebGL.';
}

const vertexShader = gl.createShader(gl.VERTEX_SHADER);
gl.shaderSource(vertexShader, vertexCode.trim());
gl.compileShader(vertexShader);

if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
  throw gl.getShaderInfoLog(vertexShader);
}

const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
gl.shaderSource(fragmentShader, fragmentCode.trim());
gl.compileShader(fragmentShader);

if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
  throw gl.getShaderInfoLog(fragmentShader);
}

const program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);

if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
  throw gl.getProgramInfoLog(program);
}

gl.useProgram(program);

const vertices = [-1, -1, 0, 1, -1, 0, 1, 1, 0, 1, 1, 0, -1, 1, 0, -1, -1, 0];

const vertexData = new Float32Array(vertices);
var buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);

const vertexPosition = gl.getAttribLocation(program, 'position');
gl.enableVertexAttribArray(vertexPosition);
gl.vertexAttribPointer(vertexPosition, 3, gl.FLOAT, false, 0, 0);

const textures = [];

for (let i = 0; i < 2; i++) {
  const targetTextureWidth = 256;
  const targetTextureHeight = 256;
  const targetTexture = gl.createTexture();

  gl.bindTexture(gl.TEXTURE_2D, targetTexture);

  const level = 0;
  const internalFormat = gl.RGBA;
  const border = 0;
  const format = gl.RGBA;
  const type = gl.UNSIGNED_BYTE;
  const data = null;

  gl.texImage2D(
    gl.TEXTURE_2D,
    level,
    internalFormat,
    targetTextureWidth,
    targetTextureHeight,
    border,
    format,
    type,
    data
  );

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  textures.push(targetTexture);
}

const fb = gl.createFramebuffer();
const textureLocation = gl.getUniformLocation(program, 'source');
gl.uniform1i(textureLocation, 0);
const invert = gl.getUniformLocation(program, 'invert')

const render = (e) => {
  var input = document.getElementById('program').value.split(' ');

  let source = 0;
  for (let i = 0; i < input.length; ++i) {
    switch (input[i]) {
      case 'apply':
        console.log('applying...');
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        const attachmentPoint = gl.COLOR_ATTACHMENT0;
        const level = 0;
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          attachmentPoint,
          gl.TEXTURE_2D,
          textures[source ^ 1],
          level
        );
        gl.bindTexture(gl.TEXTURE_2D, textures[source]);
        gl.uniform1i(invert, 1);
        gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 3);
        source ^= 1;
        break;
      default:
        throw input[0];
    }
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, textures[source]);
  gl.uniform1i(invert, 0);
  gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 3);
};
