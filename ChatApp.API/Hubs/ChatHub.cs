using ChatApp.API.Data;
using ChatApp.API.Models;
using Microsoft.AspNetCore.SignalR;
using System.Collections.Concurrent;

namespace ChatApp.API.Hubs
{
    public class ChatHub : Hub
    {
        private readonly AppDbContext _context;

        // 🔥 ONLINE USERS STORE (THIS WAS MISSING)
        private static ConcurrentDictionary<int, string> OnlineUsers
            = new ConcurrentDictionary<int, string>();

        public ChatHub(AppDbContext context)
        {
            _context = context;
        }

        // ================= LOGIN =================
        public async Task Login(int userId)
        {
            // save connection
            OnlineUsers[userId] = Context.ConnectionId;

            // add to personal group
            await Groups.AddToGroupAsync(Context.ConnectionId, userId.ToString());

            // 🔥 SEND ONLINE USERS LIST TO CURRENT USER
            await Clients.Caller.SendAsync(
                "OnlineUsers",
                OnlineUsers.Keys.ToList()
            );

            // 🔥 INFORM OTHERS THIS USER IS ONLINE
            await Clients.Others.SendAsync("UserOnline", userId);
        }

        // ================= DISCONNECT =================
        public override async Task OnDisconnectedAsync(Exception exception)
        {
            var user = OnlineUsers.FirstOrDefault(
                x => x.Value == Context.ConnectionId
            );

            if (user.Key != 0)
            {
                OnlineUsers.TryRemove(user.Key, out _);
                await Clients.Others.SendAsync("UserOffline", user.Key);
            }

            await base.OnDisconnectedAsync(exception);
        }

        // ================= SEND MESSAGE =================
        public async Task SendMessage(
            int receiverId,
            string message,
            string type,
            string fileName
        )
        {
            var sender = OnlineUsers.FirstOrDefault(
                x => x.Value == Context.ConnectionId
            );

            if (sender.Key == 0) return;

            int senderId = sender.Key;

            var msg = new Message
            {
                SenderId = senderId,
                ReceiverId = receiverId,
                Text = type == "text" ? message : string.Empty,
                Type = type,
                FileName = fileName,
                SentAt = DateTime.UtcNow
            };

            if (
                (type == "image" || type == "file" || type == "audio") &&
                message.StartsWith("data:")
            )
            {
                var base64 = message.Substring(message.IndexOf(",") + 1);
                msg.FileBytes = Convert.FromBase64String(base64);
            }

            _context.Messages.Add(msg);
            await _context.SaveChangesAsync();

            // 🔔 SEND TO RECEIVER
            await Clients.Group(receiverId.ToString())
                .SendAsync(
                    "ReceiveMessage",
                    senderId,
                    receiverId,
                    message,
                    type,
                    fileName
                );

            // 🔄 SEND BACK TO SENDER
            await Clients.Caller
                .SendAsync(
                    "ReceiveMessage",
                    senderId,
                    receiverId,
                    message,
                    type,
                    fileName
                );
        }

        // ================= TYPING =================
        public async Task UserTyping(int senderId, int receiverId)
        {
            await Clients.Group(receiverId.ToString())
                .SendAsync("UserTyping", senderId);
        }

        // ================= VIDEO =================
        public async Task SendVideoOffer(int userId, string offer)
        {
            await Clients.Group(userId.ToString())
                .SendAsync("ReceiveVideoOffer", GetSenderId(), offer);
        }

        public async Task SendVideoAnswer(int userId, string answer)
        {
            await Clients.Group(userId.ToString())
                .SendAsync("ReceiveVideoAnswer", answer);
        }

        public async Task SendIceCandidate(int userId, string candidate)
        {
            await Clients.Group(userId.ToString())
                .SendAsync("ReceiveIceCandidate", candidate);
        }

        private int GetSenderId()
        {
            return OnlineUsers.First(
                x => x.Value == Context.ConnectionId
            ).Key;
        }
    }
}
