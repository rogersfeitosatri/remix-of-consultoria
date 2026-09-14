export interface CheckinFeedbackState {
  status?: string | null;
  publication_status?: string | null;
  sent_at?: string | null;
  published_at?: string | null;
}

export interface CheckinResponseState {
  review_status?: string | null;
  closed_reason?: string | null;
}

/** Preparing/approving a draft never discharges the delivery obligation. */
export function checkinWorkflow(response: CheckinResponseState, feedback?: CheckinFeedbackState | null) {
  if (feedback?.sent_at && feedback.status === 'sent') {
    return { resolved: true, label: 'Feedback enviado', action: 'Consultar' };
  }
  if (feedback?.publication_status === 'published' && feedback.published_at) {
    return { resolved: true, label: 'Feedback publicado', action: 'Consultar' };
  }
  if (response.review_status === 'closed') {
    return { resolved: true, label: response.closed_reason === 'reviewed_without_feedback' ? 'Encerrado sem feedback' : 'Revisão encerrada', action: 'Consultar' };
  }
  if (feedback?.status === 'approved' || feedback?.publication_status === 'approved') {
    return { resolved: false, label: 'Feedback pronto para enviar', action: 'Conferir e enviar' };
  }
  if (feedback) return { resolved: false, label: 'Feedback em rascunho', action: 'Continuar análise' };
  return { resolved: false, label: 'Aguardando análise', action: 'Analisar check-in' };
}
