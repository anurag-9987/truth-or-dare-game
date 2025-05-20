import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import io from "socket.io-client";

const socket = io("http://localhost:5000", {
  withCredentials: true,
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 3000,
});

const categories = ["all", "friends", "couple", "dirty", "good"];

function App() {
  const [players, setPlayers] = useState([]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [currentPlayerId, setCurrentPlayerId] = useState(null);
  const [category, setCategory] = useState("all");
  const [choice, setChoice] = useState(null);
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState("");
  const [playerForm, setPlayerForm] = useState({
    name: "",
    age: "",
    gender: "",
  });
  const [chatHistory, setChatHistory] = useState([]);
  const [chatMessage, setChatMessage] = useState("");
  const [currentTurnId, setCurrentTurnId] = useState(null);

  const [onlineCount, setOnlineCount] = useState(0);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [questionForm, setQuestionForm] = useState({
    text: "",
    type: "truth",
    category: "all",
    difficulty: 1,
  });

  const socketRef = useRef(socket);

  console.log(chatHistory);
  useEffect(() => {
    const storedPlayer = JSON.parse(localStorage.getItem("player"));
    const currentSocket = socketRef.current;

    const handleTurnUpdate = (socketId) => {
      setCurrentTurnId(socketId);
    };
    const handleConnect = () => {
      console.log("✅ Connected:", currentSocket.id);
      if (storedPlayer) {
        setCurrentPlayerId(storedPlayer._id);
        currentSocket.emit("join", storedPlayer);
      }
    };

    const handleUpdatePlayers = (updatedPlayers) => {
      setPlayers(updatedPlayers);
      setOnlineCount(updatedPlayers.length);

      if (currentPlayerId) {
        const newIndex = updatedPlayers.findIndex(
          (p) => p._id === currentPlayerId
        );
        if (newIndex !== -1) setCurrentPlayerIndex(newIndex);
      }
    };

    const handleError = (message) => {
      alert(message);
      setChoice(null);
      setQuestion(null);
    };

    currentSocket.on("connect", handleConnect);
    currentSocket.on("updatePlayers", handleUpdatePlayers);
    currentSocket.on("turnChanged", (playerId) => {
      setCurrentPlayerIndex(players.findIndex((p) => p._id === playerId));
    });
    socketRef.current.on("turnUpdate", handleTurnUpdate);

    currentSocket.on("newQuestion", ({ choice, question }) => {
      setChoice(choice);
      setQuestion(question);
    });
    currentSocket.on("newMessage", ({ playerName, content }) => {
      setChatHistory((prev) => {
        const newHistory = [...prev, { playerName, content }];
        return newHistory.slice(-10);
      });
    });

    currentSocket.on("error", handleError);
    currentSocket.on("disconnect", (reason) => {
      console.log("Disconnected:", reason);
    });
    currentSocket.on("connect_error", (err) => {
      console.error("Connection error:", err.message);
    });

    if (!currentSocket.connected) {
      currentSocket.connect();
    }

    return () => {
      currentSocket.off("connect", handleConnect);
      currentSocket.off("updatePlayers", handleUpdatePlayers);
      currentSocket.off("turnChanged");
      currentSocket.off("newQuestion");
      currentSocket.off("newMessage"); // Add this line
      socketRef.current.off("turnUpdate", handleTurnUpdate);

      currentSocket.off("error");
      currentSocket.off("disconnect");
      currentSocket.off("connect_error");
    };
  }, [currentPlayerId,currentTurnId]);

  const sendChatMessage = () => {
    if (chatMessage.trim() && currentPlayer?.name) {
      socketRef.current.emit("chatMessage", {
        playerName: currentPlayer.name,
        message: chatMessage.trim(),
      });
      setChatMessage("");
    }
  };

  const addPlayer = async () => {
    try {
      const res = await axios.post(
        "http://localhost:5000/api/players",
        playerForm
      );
      const playerData = {
        _id: res.data._id,
        name: res.data.name,
        age: res.data.age,
        gender: res.data.gender,
        socketId: socketRef.current.id, // Add socket ID to player data
      };

      localStorage.setItem("player", JSON.stringify(playerData));
      setCurrentPlayerId(playerData._id);
      socketRef.current.emit("join", playerData);
      setPlayerForm({ name: "", age: "", gender: "" });
    } catch (error) {
      alert("Error adding player: " + (error.response?.data || error.message));
    }
  };

  const handleChoice = (type) => {
    if (currentPlayerId) {
      setChoice("loading");
      socketRef.current.emit("choose", {
        playerId: currentPlayerId,
        type,
        category,
      });
    }
  };

  // Modify handleDone to use newMessage event
  const handleDone = () => {
    if (currentPlayerId && answer.trim()) {
      socketRef.current.emit("done", {
        playerId: currentPlayerId,
        answer: answer.trim(),
        playerName: currentPlayer?.name,
      });
      setChoice(null);
      setQuestion(null);
      setAnswer("");
    }
  };

  const handleQuestionSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post("http://localhost:5000/api/questions", questionForm);
      setQuestionForm({
        text: "",
        type: "truth",
        category: "all",
        difficulty: 1,
      });
      alert("Question added successfully!");
    } catch (error) {
      alert(
        "Failed to add question: " +
          (error.response?.data?.message || error.message)
      );
    }
  };

const currentPlayer = players.find(p => p._id === currentPlayerId);

  return (
    <div
      style={{
        padding: "2rem",
        textAlign: "center",
        maxWidth: "800px",
        margin: "0 auto",
      }}
    >
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      <h1 style={{ color: "#2c3e50", marginBottom: "1rem" }}>Truth or Dare</h1>
      <p style={{ fontSize: "1.2rem", marginBottom: "2rem" }}>
        Online Players: {onlineCount}
      </p>

      {!currentPlayerId ? (
        <div
          style={{
            marginBottom: "2rem",
            padding: "1.5rem",
            borderRadius: "8px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          }}
        >
          <h3 style={{ marginBottom: "1rem" }}>Join Game</h3>
          <div
            style={{
              display: "grid",
              gap: "1rem",
              maxWidth: "300px",
              margin: "0 auto",
            }}
          >
            <input
              placeholder="Name"
              value={playerForm.name}
              onChange={(e) =>
                setPlayerForm((p) => ({ ...p, name: e.target.value }))
              }
              style={{ padding: "0.5rem" }}
            />
            <input
              placeholder="Age"
              type="number"
              value={playerForm.age}
              onChange={(e) =>
                setPlayerForm((p) => ({ ...p, age: e.target.value }))
              }
              style={{ padding: "0.5rem" }}
            />
            <select
              value={playerForm.gender}
              onChange={(e) =>
                setPlayerForm((p) => ({ ...p, gender: e.target.value }))
              }
              style={{ padding: "0.5rem" }}
            >
              <option value="">Select Gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
            <button
              onClick={addPlayer}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "#3498db",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Join Game
            </button>
          </div>
        </div>
      ) : (
        <>
          {currentPlayer && currentPlayer.socketId === currentTurnId ? (
            <div
              style={{
                padding: "1.5rem",
                borderRadius: "8px",
                backgroundColor: "#f8f9fa",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              }}
            >
              <h2 style={{ color: "#27ae60", marginBottom: "1.5rem" }}>
                Your Turn, {currentPlayer.name}!
              </h2>

              {!choice ? (
                <>
                  <div style={{ marginBottom: "1.5rem" }}>
                    <label style={{ marginRight: "0.5rem" }}>Category: </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      style={{ padding: "0.5rem" }}
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "1rem",
                      justifyContent: "center",
                    }}
                  >
                    <button
                      onClick={() => handleChoice("truth")}
                      style={{
                        padding: "0.75rem 1.5rem",
                        backgroundColor: "#e74c3c",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "1.1rem",
                      }}
                    >
                      Truth
                    </button>
                    <button
                      onClick={() => handleChoice("dare")}
                      style={{
                        padding: "0.75rem 1.5rem",
                        backgroundColor: "#2980b9",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "1.1rem",
                      }}
                    >
                      Dare
                    </button>
                  </div>
                </>
              ) : choice === "loading" ? (
                <div style={{ padding: "2rem" }}>
                  <p>Loading {category} question...</p>
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      margin: "0 auto",
                      border: "4px solid #f3f3f3",
                      borderTop: "4px solid #3498db",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite",
                    }}
                  />
                </div>
              ) : (
                <div style={{ textAlign: "left" }}>
                  <h3 style={{ color: "#2c3e50" }}>
                    {choice.toUpperCase()} Question ({category}):
                  </h3>
                  <p
                    style={{
                      fontSize: "1.2rem",
                      margin: "1rem 0",
                      padding: "1rem",
                      backgroundColor: "white",
                      borderRadius: "4px",
                    }}
                  >
                    {question}
                  </p>
                  <textarea
                    rows="4"
                    placeholder="Type your answer here..."
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      marginBottom: "1rem",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                    }}
                  />
                  <button
                    onClick={handleDone}
                    style={{
                      padding: "0.75rem 1.5rem",
                      backgroundColor: "#27ae60",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      width: "100%",
                    }}
                  >
                    Submit Answer
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                padding: "1.5rem",
                backgroundColor: "#f8f9fa",
                borderRadius: "8px",
                marginTop: "1rem",
              }}
            >
              <h2 style={{ color: "#e67e22" }}>
                {currentPlayer
                  ? `Waiting for ${currentPlayer.name}'s turn...`
                  : "Game in Progress..."}
              </h2>
            </div>
          )}
        </>
      )}

      {!currentPlayerId && (
        <div
          style={{
            marginTop: "2rem",
            padding: "1.5rem",
            backgroundColor: "#f0f0f0",
            borderRadius: "8px",
          }}
        >
          <button
            onClick={() => setShowQuestionForm(!showQuestionForm)}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#95a5a6",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              marginBottom: "1rem",
            }}
          >
            {showQuestionForm ? "Hide Question Form" : "Add New Question"}
          </button>

          {showQuestionForm && (
            <div
              style={{
                padding: "1rem",
                backgroundColor: "white",
                borderRadius: "8px",
              }}
            >
              <h3>Create New Question</h3>
              <form onSubmit={handleQuestionSubmit}>
                <div style={{ marginBottom: "1rem" }}>
                  <textarea
                    placeholder="Enter your question..."
                    value={questionForm.text}
                    onChange={(e) =>
                      setQuestionForm({ ...questionForm, text: e.target.value })
                    }
                    style={{
                      width: "100%",
                      minHeight: "100px",
                      padding: "0.5rem",
                      marginBottom: "1rem",
                    }}
                    required
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: "1rem",
                    marginBottom: "1rem",
                  }}
                >
                  <div>
                    <label>Type: </label>
                    <select
                      value={questionForm.type}
                      onChange={(e) =>
                        setQuestionForm({
                          ...questionForm,
                          type: e.target.value,
                        })
                      }
                      style={{ width: "100%", padding: "0.5rem" }}
                    >
                      <option value="truth">Truth</option>
                      <option value="dare">Dare</option>
                    </select>
                  </div>

                  <div>
                    <label>Category: </label>
                    <select
                      value={questionForm.category}
                      onChange={(e) =>
                        setQuestionForm({
                          ...questionForm,
                          category: e.target.value,
                        })
                      }
                      style={{ width: "100%", padding: "0.5rem" }}
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label>Difficulty (1-5): </label>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      value={questionForm.difficulty}
                      onChange={(e) =>
                        setQuestionForm({
                          ...questionForm,
                          difficulty: e.target.value,
                        })
                      }
                      style={{ width: "100%", padding: "0.5rem" }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  style={{
                    padding: "0.75rem 1.5rem",
                    backgroundColor: "#2ecc71",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Submit Question
                </button>
              </form>
            </div>
          )}
        </div>
      )}
      <div
        style={{
          marginTop: "2rem",
          backgroundColor: "#f8f9fa",
          borderRadius: "8px",
          padding: "1rem",
        }}
      >
        <h3 style={{ color: "#2c3e50", marginBottom: "1rem" }}>Chat History</h3>
        <div
          style={{
            maxHeight: "300px",
            overflowY: "auto",
            marginBottom: "1rem",
          }}
        >
          {chatHistory.map((msg, index) => (
            <div
              key={index}
              style={{
                marginBottom: "0.5rem",
                padding: "0.5rem",
                backgroundColor:
                  msg.playerName === "Question" ? "#e3f2fd" : "white",
                borderRadius: "4px",
                display: "flex",
                alignItems: "baseline",
                gap: "0.5rem",
              }}
            >
              {msg.playerName === "Question" ? (
                <span style={{ fontWeight: "bold", color: "#1e88e5" }}>
                  {msg.content}
                </span>
              ) : (
                <>
                  <strong style={{ minWidth: "fit-content" }}>
                    {msg.playerName}:
                  </strong>
                  <span style={{ wordBreak: "break-word", lineHeight: "1.4" }}>
                    {msg.content}
                  </span>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Chat input */}
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            type="text"
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            placeholder="Type your message..."
            style={{
              flexGrow: 1,
              padding: "0.5rem",
              borderRadius: "4px",
              border: "1px solid #ddd",
            }}
            onKeyPress={(e) => e.key === "Enter" && sendChatMessage()}
          />
          <button
            onClick={sendChatMessage}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#3498db",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
