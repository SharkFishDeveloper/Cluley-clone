// App.jsx
import "./App.css";
import Home from "./components/Home.jsx";

export default function App() {
  return (
    <div className="app-wrap">
      {/* Drag pill (global, always draggable) */}
      {/* <div className="title-drag drag" /> */}
      {/* Your app */}
      <Home />
    </div>
  );
}
