// Workaround para bug do whatwg-fetch 3.6.20 (trazido por react-native 0.83)
// que constroi `new Response(body, { status: 0 })` quando XHR falha sem
// resposta — Response valida 200..599 e lanca RangeError. Status 0 vira 599
// (network error generico) para preservar a rejeicao mas evitar crash do bundle.
const OriginalResponse = globalThis.Response;

if (OriginalResponse) {
  class SafeResponse extends OriginalResponse {
    constructor(body?: BodyInit | null, init?: ResponseInit) {
      if (init && typeof init.status === 'number') {
        const s = init.status;
        if (s < 200 || s > 599) {
          init = { ...init, status: 599 };
        }
      }
      super(body, init);
    }
  }
  // @ts-expect-error - override global
  globalThis.Response = SafeResponse;
}
