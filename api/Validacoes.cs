using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace Pf.Api;

/// <summary>
/// Validação e sanitização server-side. Espelha src/utils/validators.js — o front valida
/// para UX, mas o servidor NUNCA confia no cliente e revalida tudo.
/// </summary>
public static partial class Validacoes
{
    // Limites defensivos para o envio de respostas (evita payloads abusivos).
    public const int MaxRespostas = 60;          // nº máx. de chaves no dicionário
    public const int MaxTamanhoResposta = 8000;  // chars por resposta (discursivas)
    public const int MaxTempoSegundos = 6 * 60 * 60; // 6h — teto sanidade

    [GeneratedRegex(@"^[A-Za-zÀ-ÿ'’.\s]+$")]
    private static partial Regex NomeRegex();

    [GeneratedRegex(@"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")]
    private static partial Regex EmailRegex();

    [GeneratedRegex(@"^\d{17,20}$")]
    private static partial Regex DiscordIdRegex();

    /// <summary>Valida a inscrição. Retorna dicionário campo→erro (vazio = válido).</summary>
    public static Dictionary<string, string> ValidarInscricao(InscricaoRequest dados)
    {
        var erros = new Dictionary<string, string>();

        var nome = (dados.Nome ?? "").Trim();
        if (nome.Length < 3)
            erros["nome"] = "Informe o nome completo (mínimo 3 caracteres).";
        else if (!NomeRegex().IsMatch(nome))
            erros["nome"] = "O nome deve conter apenas letras.";
        else if (Regex.Split(nome, @"\s+").Length < 2)
            erros["nome"] = "Informe nome e sobrenome.";

        var email = (dados.Email ?? "").Trim();
        if (email.Length == 0)
            erros["email"] = "Informe seu e-mail real.";
        else if (!EmailRegex().IsMatch(email))
            erros["email"] = "E-mail inválido. Use um e-mail real e válido.";

        if (dados.Idade is null)
            erros["idade"] = "Informe sua idade.";
        else if (dados.Idade < 18)
            erros["idade"] = "É necessário ter no mínimo 18 anos para o cargo.";
        else if (dados.Idade > 70)
            erros["idade"] = "Idade fora do limite permitido para o certame.";

        var cpf = (dados.Cpf ?? "").Trim();
        if (cpf.Length == 0)
            erros["cpf"] = "Informe seu CPF (ID do Discord).";
        else if (!DiscordIdRegex().IsMatch(cpf))
            erros["cpf"] = "ID do Discord inválido (deve conter entre 17 e 20 dígitos).";

        if (!Carreiras.Existe(dados.Carreira))
            erros["carreira"] = "Selecione uma carreira válida.";

        return erros;
    }

    /// <summary>
    /// Sanitiza o dicionário de respostas recebido: limita quantidade e tamanho,
    /// descarta chaves/valores inválidos. Protege a correção de payloads maliciosos.
    /// </summary>
    public static Dictionary<string, string?> SanitizarRespostas(Dictionary<string, string?>? respostas)
    {
        var limpo = new Dictionary<string, string?>();
        if (respostas is null) return limpo;

        foreach (var (chave, valor) in respostas)
        {
            if (limpo.Count >= MaxRespostas) break;
            if (string.IsNullOrWhiteSpace(chave) || chave.Length > 64) continue;

            var v = valor ?? "";
            if (v.Length > MaxTamanhoResposta) v = v[..MaxTamanhoResposta];
            limpo[chave] = v;
        }
        return limpo;
    }

    /// <summary>Limita o tempo informado a uma faixa sã (0..6h).</summary>
    public static int? SanitizarTempo(int? segundos)
    {
        if (segundos is null) return null;
        return Math.Clamp(segundos.Value, 0, MaxTempoSegundos);
    }

    /// <summary>
    /// Normaliza o nome para a regra de tentativa única: minúsculo, sem acentos,
    /// espaços colapsados. Evita burlar a regra mudando capitalização/acentuação.
    /// </summary>
    public static string NormalizarNome(string? nome)
    {
        var v = (nome ?? "").Trim().ToLowerInvariant();
        v = Regex.Replace(v, @"\s+", " ");

        var decomposto = v.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(decomposto.Length);
        foreach (var ch in decomposto)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark)
                sb.Append(ch);
        }
        return sb.ToString().Normalize(NormalizationForm.FormC);
    }
}
