using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;

namespace Pcsp.Api;

/// <summary>
/// Autenticação do painel por SESSÃO. O login confere a senha (segredo do servidor,
/// nunca enviado ao front) e emite um token aleatório de sessão com validade. As chamadas
/// administrativas enviam esse token (header X-Admin-Token); a senha jamais trafega depois.
/// Sessões ficam em memória (basta 1 instância) e expiram; reiniciar o servidor pede novo login.
/// </summary>
public sealed class AdminAuth
{
    private readonly ConcurrentDictionary<string, DateTimeOffset> _sessoes = new();
    private readonly IConfiguration _cfg;

    public AdminAuth(IConfiguration cfg) => _cfg = cfg;

    private string Senha => _cfg["Admin:Senha"] ?? "";
    private TimeSpan Ttl => TimeSpan.FromHours(_cfg.GetValue("Admin:SessaoHoras", 8.0));

    public (bool ok, string? token, DateTimeOffset expiraEm) Login(string? senha)
    {
        var esperado = Senha;
        if (string.IsNullOrEmpty(esperado)) return (false, null, default); // sem senha configurada = bloqueado

        var a = Encoding.UTF8.GetBytes(senha ?? "");
        var b = Encoding.UTF8.GetBytes(esperado);
        if (a.Length != b.Length || !CryptographicOperations.FixedTimeEquals(a, b))
            return (false, null, default);

        LimparExpiradas();
        var token = Base64Url(RandomNumberGenerator.GetBytes(32));
        var expira = DateTimeOffset.UtcNow + Ttl;
        _sessoes[token] = expira;
        return (true, token, expira);
    }

    public bool Validar(string? token)
    {
        if (string.IsNullOrEmpty(token)) return false;
        if (!_sessoes.TryGetValue(token, out var expira)) return false;
        if (expira < DateTimeOffset.UtcNow)
        {
            _sessoes.TryRemove(token, out _);
            return false;
        }
        return true;
    }

    public void Logout(string? token)
    {
        if (!string.IsNullOrEmpty(token)) _sessoes.TryRemove(token!, out _);
    }

    private void LimparExpiradas()
    {
        var agora = DateTimeOffset.UtcNow;
        foreach (var kv in _sessoes)
            if (kv.Value < agora) _sessoes.TryRemove(kv.Key, out _);
    }

    private static string Base64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
