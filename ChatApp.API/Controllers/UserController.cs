using ChatApp.API.Data;
using ChatApp.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;


[AllowAnonymous]
[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly AppDbContext _context;
    public UsersController(AppDbContext context) => _context = context;

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        try
        {
            Console.WriteLine("LOGIN API HIT");

            if (request == null)
                return BadRequest("Request body is null");

            Console.WriteLine($"Username: {request.Username}");
            Console.WriteLine($"Password: {request.Password}");

            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Username == request.Username);

            if (user == null)
                return Unauthorized("User not found");

            if (user.Password != request.Password)
                return Unauthorized("Wrong password");

            return Ok(new { user.Id, user.Username });
        }
        catch (Exception ex)
        {
            Console.WriteLine("LOGIN ERROR:");
            Console.WriteLine(ex.ToString());
            return StatusCode(500, ex.Message);
        }
    }



    [HttpGet]
    public async Task<IActionResult> GetUsers()
        => Ok(await _context.Users.Select(u => new { u.Id, u.Username }).ToListAsync());

    [HttpGet("messages/{userId1}/{userId2}")]
    public async Task<IActionResult> GetMessages(int userId1, int userId2)
    {
        var messages = await _context.Messages
            .Where(m => (m.SenderId == userId1 && m.ReceiverId == userId2)
                     || (m.SenderId == userId2 && m.ReceiverId == userId1))
            .OrderBy(m => m.SentAt)
            .ToListAsync();

        var result = messages.Select(m => new
        {
            m.Id,
            m.SenderId,
            m.ReceiverId,
            m.Text,
            m.Type,
            m.FileName,
            FileBase64 = m.FileBytes != null
                          ? $"data:{m.Type};base64,{Convert.ToBase64String(m.FileBytes)}"
                          : ""
        });

        return Ok(result);
    }
}

public class LoginRequest { public string Username { get; set; } = ""; public string Password { get; set; } = ""; }
