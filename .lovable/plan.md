## Botão "Baixar PDF" na Revisão de Check-in

Adicionar um botão na página `CheckinReview` (`/checkin-review/:responseId`) que gera um PDF com perguntas e respostas do atleta, disponível para todos os check-ins.

### Localização do botão

No header da página, ao lado do botão "WhatsApp" e do badge de status (linha ~554-565), antes do `getStatusBadge`. Manterá o mesmo estilo visual (`variant="outline"`, `size="sm"`, ícone `Download`).

### Conteúdo do PDF

**Cabeçalho:**
- Título: "Revisão de Check-in"
- Nome do atleta + data do check-in (`submitted_at` formatada em pt-BR)
- Prova alvo (se existir): nome, data e dias restantes
- Nome do formulário usado

**Corpo:**
- Lista numerada de perguntas e respostas (mesma lógica de extração já usada em linhas 682-699: trata respostas como string, número, array ou objeto `{answer, comment}`)
- Comentários adicionais em itálico abaixo da resposta quando existirem
- "Não respondido" quando vazio

**Rodapé:**
- Data de geração + marca "Gerado por Zona Nutri"

### Implementação técnica

- Reusar bibliotecas já presentes no projeto: `jspdf` e `html2canvas` (já usadas em `PeriodizationExportButton.tsx`)
- Criar componente isolado `src/components/checkin/CheckinReviewPdfButton.tsx` recebendo `checkinResponse`, `questions`, `athleteProfile` e `targetRaceDays` como props
- Renderizar HTML invisível (off-screen) com layout limpo A4-friendly e fazer captura via `html2canvas` → tile vertical em páginas A4 no `jsPDF` (mesmo padrão do `exportPDF` existente)
- Nome do arquivo: `checkin-{nome-atleta-slug}-{yyyy-MM-dd}.pdf`
- Escapar HTML do conteúdo dinâmico (função `esc()` igual ao padrão existente) para prevenir XSS
- Botão com estado `loading` durante a geração

### Arquivos afetados

- **Novo:** `src/components/checkin/CheckinReviewPdfButton.tsx`
- **Editado:** `src/pages/CheckinReview.tsx` (importar e renderizar o botão no header)

### Fora do escopo

- Não inclui aba "Análise IA", "Feedback", "Evolução" nem "Histórico" no PDF — apenas Perguntas & Respostas conforme solicitado
- Não altera dados nem cria nova tabela
