import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import QuestionBank from "./bank/QuestionBank";
import "./styles.css";

const questionBank = new URLSearchParams(location.search).get("tool") === "question-bank";
document.title = questionBank ? "Question bank · Maths Tools" : "Maths Booklet Tools";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {questionBank ? <QuestionBank /> : <App />}
  </StrictMode>,
);
