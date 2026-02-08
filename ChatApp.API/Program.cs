using ChatApp.API.Data;
using ChatApp.API.Hubs;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Controllers
builder.Services.AddControllers();

// Database (PostgreSQL)
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("DefaultConnection")
    )
);

// ✅ CORS — MUST BE BEFORE builder.Build()
builder.Services.AddCors(options =>
{
    options.AddPolicy("CorsPolicy", policy =>
    {
        policy
            .WithOrigins(
                "https://chatapp-ui-snwt.onrender.com",
                "http://localhost:3000"
            )
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

// Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// SignalR
builder.Services.AddSignalR(options =>
{
    options.MaximumReceiveMessageSize = 10 * 1024 * 1024;
});

// ❗ ONLY NOW build the app
var app = builder.Build();
app.UseSwagger();
app.UseSwaggerUI();

app.UseHttpsRedirection();

app.UseRouting();

// ✅ CORS must be AFTER routing, BEFORE auth
app.UseCors("CorsPolicy");

app.UseAuthorization();

app.MapControllers();
app.MapHub<ChatHub>("/chathub");

app.Run();
