import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

// Map database / validation errors to friendly API errors.
export function errorHandler(err, req, res, _next) {
  let status = 500, code = 'INTERNAL', message = 'Something went wrong';

  if (err instanceof HttpError) { ({ status, code, message } = err); }
  else if (err instanceof ZodError) {
    status = 400; code = 'VALIDATION_ERROR';
    message = err.issues.map(i => `${i.path.join('.') || 'value'}: ${i.message}`).join('; ');
  }
  else if (err?.sqlState === '45000') {
    // our stored procedures raise "CODE: text"
    const [c, ...rest] = String(err.sqlMessage || err.message).split(': ');
    code = c; message = rest.join(': ') || c;
    status = ({ NOT_FOUND: 404, INVALID: 400 })[c] ?? 409;
  }
  else if (err?.errno === 1062) { status = 409; code = 'DUPLICATE'; message = 'A record with the same unique value (SKU / email) already exists'; }
  else if (err?.errno === 1451) { status = 409; code = 'REFERENCED'; message = 'This record is in use by other data and cannot be deleted'; }
  else if (err?.errno === 1452) { status = 400; code = 'BAD_REFERENCE'; message = 'A selected item does not exist'; }
  else if (err?.errno === 3819 || err?.errno === 4025) { status = 400; code = 'VALIDATION_ERROR'; message = 'A value is out of the allowed range'; }
  else if (err?.type === 'entity.parse.failed') { status = 400; code = 'BAD_JSON'; message = 'Invalid JSON body'; }
  else { console.error(err); }

  res.status(status).json({ error: { code, message } });
}

// wrap async handlers so rejections reach errorHandler
export const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);
