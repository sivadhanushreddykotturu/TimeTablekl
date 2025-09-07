import React, { useState } from "react";

export default function CalculatorModal({ isOpen, onClose }) {
  const [display, setDisplay] = useState("0");
  const [previousValue, setPreviousValue] = useState(null);
  const [operation, setOperation] = useState(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const inputNumber = (num) => {
    if (waitingForOperand) {
      setDisplay(String(num));
      setWaitingForOperand(false);
    } else {
      setDisplay(display === "0" ? String(num) : display + num);
    }
  };

  const inputOperation = (nextOperation) => {
    const inputValue = parseFloat(display);

    if (previousValue === null) {
      setPreviousValue(inputValue);
    } else if (operation) {
      const currentValue = previousValue || 0;
      const newValue = calculate(currentValue, inputValue, operation);

      setDisplay(String(newValue));
      setPreviousValue(newValue);
    }

    setWaitingForOperand(true);
    setOperation(nextOperation);
  };

  const calculate = (firstValue, secondValue, operation) => {
    let result;
    switch (operation) {
      case "+":
        result = firstValue + secondValue;
        break;
      case "-":
        result = firstValue - secondValue;
        break;
      case "×":
        result = firstValue * secondValue;
        break;
      case "÷":
        result = firstValue / secondValue;
        break;
      default:
        result = secondValue;
    }
    // Apply ceiling function to all results
    return Math.ceil(result);
  };

  const performCalculation = () => {
    const inputValue = parseFloat(display);

    if (previousValue !== null && operation) {
      const newValue = calculate(previousValue, inputValue, operation);
      setDisplay(String(newValue));
      setPreviousValue(null);
      setOperation(null);
      setWaitingForOperand(true);
    }
  };

  const clear = () => {
    setDisplay("0");
    setPreviousValue(null);
    setOperation(null);
    setWaitingForOperand(false);
  };

  const inputDecimal = () => {
    if (waitingForOperand) {
      setDisplay("0.");
      setWaitingForOperand(false);
    } else if (display.indexOf(".") === -1) {
      setDisplay(display + ".");
    }
  };


  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(5px)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        className="calculator-modal"
        style={{
          background: "var(--card-bg)",
          border: "1px solid var(--border-color)",
          borderRadius: "12px",
          padding: "20px",
          minWidth: "280px",
          maxWidth: "320px",
          margin: "20px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="calculator-header">
          <h3 style={{ margin: "0 0 16px 0", color: "var(--text-primary)" }}>
            Calculator
          </h3>
        </div>

        <div className="calculator-display">
          <div
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-light)",
              borderRadius: "8px",
              padding: "16px",
              textAlign: "right",
              fontSize: "24px",
              fontWeight: "600",
              color: "var(--text-primary)",
              minHeight: "40px",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              marginBottom: "16px",
            }}
          >
            {display}
          </div>
        </div>

        <div className="calculator-buttons">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
            {/* Row 1 */}
            <button
              onClick={clear}
              className="calculator-btn secondary"
              style={{ gridColumn: "span 2" }}
            >
              Clear
            </button>
            <button
              onClick={() => inputOperation("÷")}
              className="calculator-btn operation"
            >
              ÷
            </button>
            <button
              onClick={clear}
              className="calculator-btn secondary"
            >
              C
            </button>

            {/* Row 2 */}
            <button onClick={() => inputNumber(7)} className="calculator-btn number">7</button>
            <button onClick={() => inputNumber(8)} className="calculator-btn number">8</button>
            <button onClick={() => inputNumber(9)} className="calculator-btn number">9</button>
            <button
              onClick={() => inputOperation("×")}
              className="calculator-btn operation"
            >
              ×
            </button>

            {/* Row 3 */}
            <button onClick={() => inputNumber(4)} className="calculator-btn number">4</button>
            <button onClick={() => inputNumber(5)} className="calculator-btn number">5</button>
            <button onClick={() => inputNumber(6)} className="calculator-btn number">6</button>
            <button
              onClick={() => inputOperation("-")}
              className="calculator-btn operation"
            >
              -
            </button>

            {/* Row 4 */}
            <button onClick={() => inputNumber(1)} className="calculator-btn number">1</button>
            <button onClick={() => inputNumber(2)} className="calculator-btn number">2</button>
            <button onClick={() => inputNumber(3)} className="calculator-btn number">3</button>
            <button
              onClick={() => inputOperation("+")}
              className="calculator-btn operation"
            >
              +
            </button>

            {/* Row 5 */}
            <button
              onClick={() => inputNumber(0)}
              className="calculator-btn number"
              style={{ gridColumn: "span 2" }}
            >
              0
            </button>
            <button onClick={inputDecimal} className="calculator-btn number">.</button>
            <button onClick={performCalculation} className="calculator-btn equals">=</button>
          </div>
        </div>
      </div>
    </div>
  );
}
