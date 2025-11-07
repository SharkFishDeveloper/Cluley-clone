import "./App.css";
import Home from "./components/Home.jsx";

export default function App() {
  return (
    <div className="app-wrap">
      {/* invisible draggable area (frameless window move) */}
      <div className="title-drag drag" />
      <div className="header" />
      <Home />
    </div>
  );
}
