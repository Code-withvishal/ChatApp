using ChatApp.API.Data;
using ChatApp.API.Hubs;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// ===================== SERVICES =====================

// Controllers
builder.Services.AddControllers();

// Database (PostgreSQL)
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"))
);

// Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// SignalR
builder.Services.AddSignalR();

// ====================================================

var app = builder.Build();

// ===================== HARD CORS FIX =====================
// This is REQUIRED for Render + browser preflight
app.Use(async (context, next) =>
{
    context.Response.Headers["Access-Control-Allow-Origin"] =
        "https://chatapp-ui-snwt.onrender.com";
    context.Response.Headers["Access-Control-Allow-Headers"] =
        "Content-Type, Authorization";
    context.Response.Headers["Access-Control-Allow-Methods"] =
        "GET, POST, PUT, DELETE, OPTIONS";

    if (context.Request.Method == "OPTIONS")
    {
        context.Response.StatusCode = 200;
        return;
    }

    await next();
});
// =========================================================

// Swagger
app.UseSwagger();
app.UseSwaggerUI();

app.UseHttpsRedirection();

app.UseRouting();

app.UseAuthorization();

app.MapControllers();
app.MapHub<ChatHub>("/chathub");

app.Run();
