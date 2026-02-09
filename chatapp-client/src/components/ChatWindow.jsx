// 🔥 CHANGES ONLY IN MIC RECORDING LOGIC (Rest code untouched)

import React, { useEffect, useState, useRef } from "react";
import Picker from "emoji-picker-react";
import { connection, startConnection } from "../services/signalRConnection";
import "../App.css";
import { FaVideo, FaMicrophone, FaImage, FaSmile } from "react-icons/fa";
import { MdAttachFile } from "react-icons/md";

const ChatWindow = ({ currentUser, onLogout }) => {
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [message, setMessage] = useState("");
    const [allChats, setAllChats] = useState({});
    const [notifications, setNotifications] = useState({});
    const [typingUserId, setTypingUserId] = useState(null);
    const typingTimeout = useRef(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const messagesEndRef = useRef(null);
const [showActions, setShowActions] = useState(false);

    // 🎤 AUDIO
    const mediaRecorderRef = useRef(null);
    const audioChunks = useRef([]);

    // 🎥 VIDEO CALL
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const peerRef = useRef(null);
    const localStreamRef = useRef(null);
    const [inCall, setInCall] = useState(false);

    //const API_URL = "http://localhost:5090";
    const API_URL="https://chatapp-vjiq.onrender.com";

    // ================= AUTO SCROLL =================
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [allChats, selectedUser]);

    // ================= SIGNALR =================
    useEffect(() => {
        const init = async () => {
            try {
                if (connection.state !== "Connected") await startConnection();
                if (connection.state === "Connected") {// 🔥 INITIAL ONLINE USERS LIST
connection.off("OnlineUsers");
connection.on("OnlineUsers", onlineIds => {
    setUsers(prev =>
        prev.map(u => ({
            ...u,
            online: onlineIds.includes(u.id),
        }))
    );
});

                    await connection.invoke("Login", currentUser.id);
                }

                // --------- Receive Message ----------

                connection.off("ReceiveMessage");
                connection.on("ReceiveMessage", (senderId, receiverId, messageText, messageType, fileName) => {
                    if (receiverId !== currentUser.id) return;


                    const otherUserId = String(senderId);
                    const msg = {
                        senderId,
                        type: messageType || "text",
                        fileName,
                        message: messageText,
                    };

                    setAllChats(prev => ({
                        ...prev,
                        [otherUserId]: [...(prev[otherUserId] || []), msg],
                    }));

                    if (!selectedUser || selectedUser.id !== senderId) {
                        setNotifications(prev => ({
                            ...prev,
                            [otherUserId]: (prev[otherUserId] || 0) + 1,
                        }));
                    }
                });

                // --------- Typing ----------
                connection.off("UserTyping");
                connection.on("UserTyping", senderId => {
                    if (senderId === currentUser.id) return;
                    setTypingUserId(senderId);
                    clearTimeout(typingTimeout.current);
                    typingTimeout.current = setTimeout(() => setTypingUserId(null), 1500);
                });

                // --------- Online / Offline (ADDED) ----------
                connection.off("UserOnline");
                connection.on("UserOnline", userId => {
                    setUsers(prev => prev.map(u => u.id === userId ? { ...u, online: true } : u));
                });

                connection.off("UserOffline");
                connection.on("UserOffline", userId => {
                    setUsers(prev => prev.map(u => u.id === userId ? { ...u, online: false } : u));
                });

                const res = await fetch(`${API_URL}/api/users`);
                const data = await res.json();
                setUsers(
                    data.filter(u => u.id !== currentUser.id).map(u => ({ ...u, online: false }))
                );
            } catch (err) {
                console.error(err);
            }
        };

        init();
    }, [currentUser, selectedUser]);

    // ================= VIDEO CALL START =================
    const startVideoCall = async () => {
        if (!selectedUser) return;

        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        setInCall(true);

        const peer = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });

        stream.getTracks().forEach(track => peer.addTrack(track, stream));

        peer.ontrack = e => {
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
        };

        peer.onicecandidate = e => {
            if (e.candidate) {
                connection.invoke("SendIceCandidate", selectedUser.id, JSON.stringify(e.candidate));
            }
        };

        peerRef.current = peer;

        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        await connection.invoke("SendVideoOffer", selectedUser.id, JSON.stringify(offer));
    };

    // ================= VIDEO SIGNALS =================
    useEffect(() => {
        const onOffer = async (senderId, offer) => {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            localStreamRef.current = stream;
            setInCall(true);

            const peer = new RTCPeerConnection({
                iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
            });

            stream.getTracks().forEach(track => peer.addTrack(track, stream));

            peer.ontrack = e => {
                if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
            };

            peer.onicecandidate = e => {
                if (e.candidate) {
                    connection.invoke("SendIceCandidate", senderId, JSON.stringify(e.candidate));
                }
            };

            peerRef.current = peer;

            await peer.setRemoteDescription(JSON.parse(offer));
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            await connection.invoke("SendVideoAnswer", senderId, JSON.stringify(answer));
        };

        const onAnswer = async answer => {
            if (peerRef.current) await peerRef.current.setRemoteDescription(JSON.parse(answer));
        };

        const onCandidate = async candidate => {
            if (peerRef.current) await peerRef.current.addIceCandidate(JSON.parse(candidate));
        };

        connection.on("ReceiveVideoOffer", onOffer);
        connection.on("ReceiveVideoAnswer", onAnswer);
        connection.on("ReceiveIceCandidate", onCandidate);

        return () => {
            connection.off("ReceiveVideoOffer", onOffer);
            connection.off("ReceiveVideoAnswer", onAnswer);
            connection.off("ReceiveIceCandidate", onCandidate);
        };
    }, []);

    // attach local stream after render
    useEffect(() => {
        if (inCall && localVideoRef.current && localStreamRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
        }
    }, [inCall]);

    const endVideoCall = () => {
        peerRef.current?.close();
        peerRef.current = null;
        localStreamRef.current?.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        setInCall(false);
    };

    // ================= SEND MESSAGE =================
    const sendMessage = async (msg, type = "text", fileName = null) => {
        if ((!msg && type === "text") || !selectedUser) return;
        await connection.invoke("SendMessage", selectedUser.id, msg, type, fileName);
        setAllChats(prev => ({
            ...prev,
            [String(selectedUser.id)]: [
                ...(prev[String(selectedUser.id)] || []),
                { senderId: currentUser.id, message: msg, type, fileName },
            ],
        }));
        if (type === "text") setMessage("");
        setShowEmojiPicker(false);
    };

    // ================= FETCH CHAT =================
    const fetchMessages = async (user) => {
        const res = await fetch(`${API_URL}/api/users/messages/${currentUser.id}/${user.id}`);
        const msgs = await res.json();
        const formatted = msgs.map(m => ({
            senderId: m.senderId,
            type: m.type || "text",
            fileName: m.fileName,
            message: m.type === "text" ? m.text : m.fileBase64 || "",
        }));
        setAllChats(prev => ({ ...prev, [String(user.id)]: formatted }));
    };

    const handleUserClick = async (user) => {
        setSelectedUser(user);
        setNotifications(prev => ({ ...prev, [String(user.id)]: 0 }));
        sessionStorage.setItem("lastSelectedUser", JSON.stringify(user));
        await fetchMessages(user);
    };

    useEffect(() => {
        const lastUser = sessionStorage.getItem("lastSelectedUser");
        if (lastUser) handleUserClick(JSON.parse(lastUser));
    }, []);

    // ================= FILE UPLOAD =================
    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file || !selectedUser) return;

        const formData = new FormData();
        formData.append("file", file);
        formData.append("senderId", currentUser.id);
        formData.append("receiverId", selectedUser.id);

        const res = await fetch(`${API_URL}/api/files/upload`, { method: "POST", body: formData });
        const data = await res.json();
        await sendMessage(data.fileBase64, data.type, file.name);
        e.target.value = null;
    };

    // ================= MIC =================
    const startRecording = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        audioChunks.current = [];
        recorder.ondataavailable = e => audioChunks.current.push(e.data);
        recorder.start();
    };

    const stopRecording = () => {
        const recorder = mediaRecorderRef.current;
        if (!recorder) return;
        recorder.onstop = () => {
            const blob = new Blob(audioChunks.current, { type: "audio/webm" });
            if (blob.size < 1000) return;
            const reader = new FileReader();
            reader.onloadend = () => sendMessage(reader.result.split(",")[1], "audio", "voiceMessage.webm");
            reader.readAsDataURL(blob);
        };
        recorder.stop();
    };

    // ================= UI =================
    return (
        <div className="flex flex-col h-screen bg-gray-100">
            <div className="flex justify-between items-center p-4 bg-white shadow">
                <h2 className="font-bold">{currentUser.username}</h2>
                <button onClick={onLogout} className="bg-red-500 text-white px-3 py-1 rounded">Logout</button>
            </div>

            {/* USER LIST */}
            <div className="flex overflow-x-auto p-2 space-x-3 bg-white border-b shadow">
                {users.map(u => (
                    <div key={u.id} onClick={() => handleUserClick(u)} className="cursor-pointer flex flex-col items-center">
                        <div className={`relative w-12 h-12 rounded-full flex items-center justify-center text-white font-bold 
                            ${selectedUser?.id === u.id ? "border-2 border-blue-500 bg-blue-400" : "bg-gray-400"}`}>
                            {u.username[0]}
                            {u.online && (
                                <span className="absolute top-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                            )}
                        </div>
                        <span className="text-xs mt-1 w-12 truncate text-center">{u.username}</span>
                    </div>
                ))}
            </div>

            {/* CHAT AREA */}
            <div className="flex items-center gap-2 p-2 bg-white border-t relative">

    {/* ➕ MORE BUTTON (ONLY MOBILE) */}
    <button
        onClick={() => setShowActions(p => !p)}
        className="md:hidden flex-shrink-0 p-2 hover:bg-gray-200 rounded-full"
    >
        ➕
    </button>

    {/* ACTION ICONS */}
    <div
        className={`
            ${showActions ? "flex" : "hidden"}
            absolute bottom-14 left-2 z-50 bg-white shadow rounded-xl p-2 gap-2
            md:static md:flex md:shadow-none md:p-0
        `}
    >
        <button onClick={startVideoCall} className="p-2 hover:bg-gray-200 rounded-full">
            <FaVideo size={20} />
        </button>

        <button onClick={() => setShowEmojiPicker(p => !p)} className="p-2 hover:bg-gray-200 rounded-full">
            <FaSmile size={20} />
        </button>

        <label className="cursor-pointer p-2 hover:bg-gray-200 rounded-full">
            <MdAttachFile size={22} />
            <input type="file" className="hidden" onChange={handleFileChange} />
        </label>

        <label className="cursor-pointer p-2 hover:bg-gray-200 rounded-full">
            <FaImage size={20} />
            <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
        </label>

        <button
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            className="p-2 hover:bg-gray-200 rounded-full"
        >
            <FaMicrophone size={20} />
        </button>
    </div>

    {/* EMOJI PICKER */}
    {showEmojiPicker && (
        <div className="absolute bottom-20 left-2 z-50">
            <Picker onEmojiClick={e => setMessage(prev => prev + e.emoji)} />
        </div>
    )}

    {/* INPUT */}
    <input
        value={message}
        onChange={e => {
            setMessage(e.target.value);

            if (!selectedUser) return;

            clearTimeout(typingTimeout.current);

            typingTimeout.current = setTimeout(() => {
                if (connection.state === "Connected") {
                    connection.invoke("UserTyping", currentUser.id, selectedUser.id);
                }
            }, 300);
        }}
        onKeyDown={e => e.key === "Enter" && sendMessage(message)}
        placeholder="Message..."
        className="flex-1 min-w-0 px-4 py-2 border rounded-full"
    />

    {/* SEND */}
    <button
        onClick={() => sendMessage(message)}
        disabled={!message.trim()}
        className="flex-shrink-0 px-4 py-2 bg-blue-500 text-white rounded-full"
    >
        Send
    </button>
</div>

        </div>
    );
};

export default ChatWindow;
