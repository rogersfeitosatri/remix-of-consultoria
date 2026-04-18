
## Auditoria de Consultas — Atletas Premium Recorrentes

### Escopo identificado
Atletas ativos (`is_active=true`, `is_frozen=false`) com:
- `plan_type = 'premium'` OU `plan_duration IN ('quarterly','semiannual','annual')`
- `has_consultations = true`
- `consultation_frequency IN ('monthly','six_weeks','4_weeks','6_weeks')`

Hoje há ~25+ atletas no escopo (Aluísio Júnior, Alyne Ellen, Ana Kessy, Antônio Tupinamba, Brena Gava, Bruna Ribeiro, Caio Henrique, Diogo Ferreira, Francisco João Marcos, Igor Braga, Igor Diego, Ilana Mara, etc.).

### Como vou executar
Vou rodar **uma única auditoria SQL** consolidada (read-only, sem alterar dados) e gerar um **relatório PDF + CSV** em `/mnt/documents/`.

**Fontes cruzadas:**
- `clients` (plano, frequência, datas)
- `appointments` (consultas: scheduled, confirmed, completed, cancelled, no_show)
- `consultation_schedules` (pipeline de envio de links)
- `consultation_schedule_rules` (cadência, próximo envio, último link enviado)

### Lógica de cálculo

**1ª consulta:** primeira `appointment` com status `completed/confirmed/scheduled` (ordem `appointment_date`).

**Próxima consulta prevista:** `última realizada + cadência (4 ou 6 semanas)` conforme `consultation_frequency`.

**Janela "em dia":** ±14 dias do prazo previsto.

**Classificação:**
```text
Em dia        → existe próxima consulta agendada/confirmada dentro da janela
Atenção       → próximo prazo a ≤14 dias e nenhuma futura agendada, OU sem link enviado
Atrasado      → último prazo passou >14 dias sem nova consulta
Crítico/Falha → sem 1ª consulta registrada, ou sem nenhuma futura, ou link nunca enviado
```

**Status por consulta:** Agendada / Confirmada / Realizada / Cancelada / Remarcada (derivado de `appointments.status` + cruzamento com `consultation_schedules`).

### Pendências verificadas por atleta
- [ ] 1ª consulta registrada
- [ ] Histórico cronológico coerente
- [ ] Link da próxima consulta enviado (`consultation_schedules.link_sent_at` ou `rules.last_link_sent_at`)
- [ ] Próxima consulta agendada futura
- [ ] Intervalo real entre consultas vs cadência contratada (detecta inconsistências)
- [ ] Última consulta dentro da janela ±2 semanas

### Entregáveis (em `/mnt/documents/`)

**1. `auditoria_premium_resumo.pdf`** — Relatório executivo com:
- Resumo geral: total auditados, % em dia / atenção / atrasado / crítico
- Gráfico de distribuição por status
- Tabela individual: Nome | Plano | Frequência | Última | Próxima Prevista | Status | Pendências

**2. `auditoria_premium_detalhado.csv`** — Dados completos por atleta para filtragem no Excel:
```text
nome, plan_type, plan_duration, frequencia_semanas, 
data_inicio, data_fim, primeira_consulta, ultima_realizada,
proxima_agendada, proxima_prevista, dias_desde_ultima,
desvio_cadencia_dias, total_realizadas, total_canceladas,
link_enviado, ultimo_envio_link, status_auditoria, pendencias
```

**3. `auditoria_premium_pendencias.csv`** — Apenas atletas com falhas, ordenados por criticidade (para ação imediata).

### Garantias
- **Read-only**: nenhuma alteração no banco, código ou fluxos do sistema (respeita escopo Core).
- Timezone `America/Fortaleza` em todos os cálculos de data.
- Considera apenas atletas ativos e não congelados (alinhado com a regra recém-implementada).

Após sua aprovação, executo a auditoria e entrego os 3 arquivos prontos para download.
