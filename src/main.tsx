import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import QuestionBank from "./bank/QuestionBank";
import RatioTablePage from "./ratio-table/RatioTablePage";
import "./styles.css";

const questionBank = new URLSearchParams(location.search).get("tool") === "question-bank";
const ratioTable = new URLSearchParams(location.search).get("tool") === "ratio-table";
document.title = questionBank ? "Question bank · Maths Tools" : ratioTable ? "Ratio tables · Maths Tools" : "Maths Booklet Tools";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {questionBank ? <QuestionBank /> : ratioTable ? <RatioTablePage /> : <App />}
  </StrictMode>,
);
