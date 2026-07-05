using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;
using Pf.Api;

LoadLocalEnv();

var builder = WebApplication.CreateBuilder(args);

// Porta: PaaS (Railway/Render/Fly) injeta PORT. Sem PORT, usa a configuração local de desenvolvimento.
var port = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrWhiteSpace(port))
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

// Limite de tamanho do corpo da requisição (defesa contra payloads gigantes).
builder.WebHost.ConfigureKestrel(k => k.Limits.MaxRequestBodySize = 64 * 1024); // 64 KB

// Atrás do proxy/HTTPS do PaaS: confiar em X-Forwarded-For/Proto (rate limit e esquema corretos).
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    o.KnownNetworks.Clear();
    o.KnownProxies.Clear();
});

// JSON: camelCase e omissão de nulos (espelha o formato dos mocks).
builder.Services.ConfigureHttpJsonOptions(o =>
{
    o.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    o.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
});

// CORS — só relevante se o front for hospedado em outra origem. Servindo junto (mesma origem), é dispensado.
var origens = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
              ?? new[] { "http://localhost:5173" };
builder.Services.AddCors(o => o.AddPolicy("front", p => p
    .WithOrigins(origens)
    .WithHeaders("Content-Type", "X-Admin-Token")
    .WithMethods("GET", "POST")));

// Rate limiting por IP (anti-spam/anti-brute force).
var globalPorMin = builder.Configuration.GetValue("RateLimit:GlobalPorMinuto", 120);
var escritaPorMin = builder.Configuration.GetValue("RateLimit:EscritaPorMinuto", 12);

builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    o.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
        RateLimitPartition.GetFixedWindowLimiter(IpDe(ctx), _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = globalPorMin,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
        }));

    o.AddPolicy("escrita", ctx =>
        RateLimitPartition.GetFixedWindowLimiter("w:" + IpDe(ctx), _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = escritaPorMin,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
        }));

    o.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        await context.HttpContext.Response.WriteAsJsonAsync(
            new { mensagem = "Muitas requisições em pouco tempo. Aguarde um instante e tente novamente." }, token);
    };
});

builder.Services.AddSingleton<AppStore>();
builder.Services.AddSingleton<AdminAuth>();

var app = builder.Build();

// Primeiro middleware: aplica os cabeçalhos encaminhados pelo proxy.
app.UseForwardedHeaders();

// Tratamento global de exceções: resposta genérica, sem vazar stack trace.
app.UseExceptionHandler(branch => branch.Run(async ctx =>
{
    ctx.Response.StatusCode = StatusCodes.Status500InternalServerError;
    ctx.Response.ContentType = "application/json";
    await ctx.Response.WriteAsJsonAsync(new { mensagem = "Ocorreu um erro interno. Tente novamente." });
}));

// Cabeçalhos de segurança básicos.
app.Use(async (ctx, next) =>
{
    var h = ctx.Response.Headers;
    h["X-Content-Type-Options"] = "nosniff";
    h["X-Frame-Options"] = "DENY";
    h["Referrer-Policy"] = "no-referrer";
    h["X-Permitted-Cross-Domain-Policies"] = "none";
    await next();
});

app.UseCors("front");
app.UseRateLimiter();

// Front estático (quando publicado junto, em wwwroot) + fallback de SPA.
app.UseDefaultFiles();
app.UseStaticFiles();

// Health check para o PaaS (sem rate limit).
app.MapGet("/api/health", () => Results.Ok(new { ok = true })).DisableRateLimiting();

app.MapApi();

// Qualquer rota não-API e não-arquivo serve o index.html (SPA), se houver front publicado.
app.MapFallbackToFile("index.html");

// Garante a criação do estado/edital já no start.
app.Services.GetRequiredService<AppStore>();

app.Run();

static string IpDe(HttpContext ctx) =>
    ctx.Connection.RemoteIpAddress?.ToString() ?? "desconhecido";

static void LoadLocalEnv()
{
    var dirs = new[]
    {
        Directory.GetCurrentDirectory(),
        Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "..")),
    };

    var envPath = dirs.Select(dir => Path.Combine(dir, ".env")).FirstOrDefault(File.Exists);
    if (envPath is null) return;

    foreach (var rawLine in File.ReadAllLines(envPath))
    {
        var line = rawLine.Trim();
        if (line.Length == 0 || line.StartsWith('#')) continue;

        var equals = line.IndexOf('=');
        if (equals <= 0) continue;

        var key = line[..equals].Trim();
        var value = line[(equals + 1)..].Trim().Trim('"');
        if (Environment.GetEnvironmentVariable(key) is null)
            Environment.SetEnvironmentVariable(key, value);
    }
}
