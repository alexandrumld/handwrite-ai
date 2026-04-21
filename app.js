// app.js - Handwrite Engine Initialization + UI Logic
// This file integrates RNN handwriting with the front-end UI

// Load the RNN model and initialize
const RNN = HandWriteEngine;
let appReady = false;

async function initApp() {
  console.log("Initializing HandWrite AI...");

  // Attach event listeners for UI controls
  const textInput = document.getElementById("text-input");
  const drawButton = document.getElementById("draw-button");
  const stylesSelect = document.getElementById("select-style");

  // Disable draw button during model load
  drawButton.disabled = true;
  drawButton.innerText = "Loading model...";

  // Lazy-load RNN engine
  await RNN.loadModel("d.bin");
  appReady = true;

  // Make draw button active once model is loaded
  drawButton.disabled = false;
  drawButton.innerText = "Write!";

  console.log("Model loaded. Ready for writing.");

  // On draw button click: capture text input, generate strokes
  drawButton.addEventListener("click", () => {
    const text = textInput.value || "";
    if (text.length === 0) return;
    console.log(`Received text: ${text}`);

    try {
      // Generate handwriting strokes for the given text
      const strokes = RNN.generateHandwriting(text, {
        speed: parseFloat(document.getElementById("speed-slider").value),
        bias: parseFloat(document.getElementById("bias-slider").value),
        strokeWidth: parseFloat(document.getElementById("width-slider").value),
        style: stylesSelect.value,
      });

      console.log("Generated strokes:", strokes);

      // Render strokes onto the canvas
      const canvas = document.getElementById("canvas");
      renderStrokes(strokes, canvas);
    } catch (error) {
      console.error("Error generating handwriting:", error);
    }
  });
}

function renderStrokes(strokes, canvas) {
  const svgNS = "http://www.w3.org/2000/svg";

  // Clear canvas before rendering
  while (canvas.firstChild) {
    canvas.removeChild(canvas.firstChild);
  }

  // Helper to create an SVG path from stroke data
  const createPath = (points) => {
    const path = document.createElementNS(svgNS, "path");
    const d = points.reduce((acc, [x, y], idx) => {
      return acc + (idx === 0 ? `M ${x},${y} ` : `L ${x},${y} `);
    }, "");
    path.setAttribute("d", d.trim());
    path.setAttribute("stroke", "black");
    path.setAttribute("fill", "none");
    return path;
  };

  // Render strokes as filled paths
  strokes.forEach((stroke) => {
    const path = createPath(stroke);
    canvas.appendChild(path);
  });
}

// Bootup
initApp();