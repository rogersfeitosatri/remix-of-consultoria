import { PDFDocument, StandardFonts, degrees, rgb } from 'npm:pdf-lib@1.17.1';

export const PDF_MARGIN = 20;
export const MAX_PDF_BYTES = 25 * 1024 * 1024;
export const MAX_PDF_PAGES = 600;

/** Embed the complete visible source page at its original scale. A NEW strip
 * outside the original content carries the buyer e-mail, including on full-bleed,
 * cropped and rotated pages. We never draw a watermark over the book itself. */
export async function personaliseStorePdf(bytes: Uint8Array, email: string): Promise<Uint8Array> {
  if (bytes.length > MAX_PDF_BYTES) throw new Error('pdf_too_large');
  if (!email || email.length > 254 || /[\r\n\x00]/.test(email)) throw new Error('invalid_buyer_email');
  const source = await PDFDocument.load(bytes, { updateMetadata:false });
  if (source.getPageCount() < 1 || source.getPageCount() > MAX_PDF_PAGES) throw new Error('pdf_page_limit');
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  const label = `Uso pessoal: ${email}`;
  // Fail closed if an unsupported character cannot be printed. Never return an
  // unmarked PDF, a truncated e-mail, or the original file as a fallback.
  font.encodeText(label);
  for (const page of source.getPages()) {
    const crop = page.getCropBox();
    if (crop.width < 50 || crop.height < 50) throw new Error('pdf_page_too_small');
    const embedded = await out.embedPage(page, { left:crop.x, bottom:crop.y, right:crop.x+crop.width, top:crop.y+crop.height });
    const rotation = ((page.getRotation().angle % 360) + 360) % 360;
    if (![0,90,180,270].includes(rotation)) throw new Error('pdf_rotation_unsupported');
    const sideways = rotation === 90 || rotation === 270;
    const width = sideways ? crop.height : crop.width;
    const height = sideways ? crop.width : crop.height;
    const target = out.addPage([width,height+PDF_MARGIN]);
    const position = rotation === 90 ? { x:0,y:height+PDF_MARGIN,rotate:degrees(-90) }
      : rotation === 180 ? { x:width,y:height+PDF_MARGIN,rotate:degrees(180) }
      : rotation === 270 ? { x:width,y:PDF_MARGIN,rotate:degrees(90) }
      : { x:0,y:PDF_MARGIN,rotate:degrees(0) };
    target.drawPage(embedded,position);
    target.drawRectangle({ x:0,y:0,width,height:PDF_MARGIN,color:rgb(1,1,1) });
    const size = Math.min(7, (width-20)/font.widthOfTextAtSize(label,1));
    target.drawText(label,{ x:10,y:7,size,font,color:rgb(.38,.38,.38) });
  }
  out.setTitle(source.getTitle() || 'Livro digital');
  if (source.getAuthor()) out.setAuthor(source.getAuthor()!);
  out.setSubject(`Cópia pessoal de ${email}`);
  out.setProducer('Rogers Feitosa — Loja digital');
  return out.save();
}
