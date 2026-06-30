const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F']

/**
 * Renderiza uma questão (fechada ou aberta) e reporta a resposta via onResponder.
 */
export default function Questao({ numero, questao, resposta, onResponder }) {
  const respondida = resposta !== undefined && resposta !== null && resposta !== ''

  return (
    <article className={`questao ${respondida ? 'questao--respondida' : ''}`} id={`q-${questao.id}`}>
      <header className="questao__cab">
        <span className="questao__num">{numero}</span>
        <span className="questao__area">{questao.area}</span>
        {questao.tipo === 'aberta' && <span className="questao__tag">Discursiva</span>}
      </header>

      <p className="questao__enunciado">{questao.enunciado}</p>

      {questao.tipo === 'fechada' ? (
        <ul className="alternativas">
          {questao.alternativas.map((alt, i) => {
            const selecionada = resposta === alt.id
            return (
              <li key={alt.id}>
                <label className={`alternativa ${selecionada ? 'is-selecionada' : ''}`}>
                  <input
                    type="radio"
                    name={questao.id}
                    value={alt.id}
                    checked={selecionada}
                    onChange={() => onResponder(questao.id, alt.id)}
                  />
                  <span className="alternativa__letra">{LETRAS[i]}</span>
                  <span className="alternativa__texto">{alt.texto}</span>
                </label>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="discursiva">
          <textarea
            className="discursiva__campo"
            rows={Math.max(6, questao.linhasSugeridas || 8)}
            placeholder="Digite sua resposta aqui..."
            value={resposta || ''}
            maxLength={4000}
            onChange={(e) => onResponder(questao.id, e.target.value)}
          />
          <div className="discursiva__rodape">
            <span>Sugestão: até {questao.linhasSugeridas || 15} linhas.</span>
            <span>{(resposta || '').length}/4000</span>
          </div>
        </div>
      )}
    </article>
  )
}
