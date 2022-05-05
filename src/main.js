function main() {
  const canvas = document.getElementById('canvas');

  const gl = canvas.getContext('webgl');

  if (gl === null) {
    alert('Unable to initialize WebGL.');
    return;
  }

  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);
}

window.onload = main;
