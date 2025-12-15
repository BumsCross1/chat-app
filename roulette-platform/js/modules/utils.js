// --- Zufallszahl für Roulette (0-36) ---
function getRandomRouletteNumber() {
    return Math.floor(Math.random() * 37);
  }
  
  // --- Prüft, ob Zahl Rot oder Schwarz ist ---
  function getColor(number) {
    const redNumbers = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
    const blackNumbers = [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35];
    if (number === 0) return "green";
    if (redNumbers.includes(number)) return "red";
    if (blackNumbers.includes(number)) return "black";
    return null;
  }
  
  // --- Prüft, ob ein Bet gewonnen hat ---
  function checkBetWin(betField, resultNumber) {
    if (!betField) return false;
    if (betField === resultNumber.toString()) return true; // Zahl richtig
    if (betField === "red" && getColor(resultNumber) === "red") return true;
    if (betField === "black" && getColor(resultNumber) === "black") return true;
    return false;
  }
  
  // --- Animation: Chip fliegen lassen ---
  function animateChip(chipEl, targetX, targetY, duration = 1000) {
    chipEl.style.transition = `transform ${duration}ms ease-out, opacity ${duration}ms`;
    chipEl.style.transform = `translate(${targetX}px, ${targetY}px) scale(1)`;
    chipEl.style.opacity = 1;
  
    // Entfernt Chip nach Animation
    setTimeout(() => {
      if (chipEl.parentNode) chipEl.parentNode.removeChild(chipEl);
    }, duration + 50);
  }
  
  // --- Helper: DOM-Element erstellen ---
  function createElement(tag, className, innerText) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (innerText) el.innerText = innerText;
    return el;
  }
  
  // --- Helper: Zufalls-Position in Bereich ---
  function getRandomPosition(xRange = 100, yRange = 100) {
    const x = (Math.random() - 0.5) * xRange;
    const y = (Math.random() - 0.5) * yRange;
    return { x, y };
  }
  