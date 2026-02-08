using ChatApp.API.Data;
using ChatApp.API.Hubs;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"))
);

builder.Services.AddSignalR();

builder.Services.AddCors(options =>
{
    options.AddPolicy("RenderCors", policy =>
    policy.WithOrigins("https://chatapp-ui-snwt.onrender.com")
          .AllowAnyHeader()
          .AllowAnyMethod()
          .AllowCredentials());
});

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();

app.UseRouting();

app.UseCors("RenderCors"); // MUST be before endpoints

app.UseAuthorization();

app.MapControllers();
app.MapHub<ChatHub>("/chathub").RequireCors("RenderCors");

app.MapGet("/", () => "ChatApp API running");

app.Run();
