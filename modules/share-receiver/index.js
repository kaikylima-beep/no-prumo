// Arquivos recebidos pelo menu "Compartilhar" do Android (só existe no APK).
import { requireOptionalNativeModule } from 'expo';

const Native = requireOptionalNativeModule('ShareReceiver');

export function getInitialShare() {
  try {
    return Native ? Native.getInitialShare() : null;
  } catch (e) {
    return null;
  }
}

export function addShareListener(listener) {
  if (!Native || !Native.addListener) return { remove() {} };
  return Native.addListener('onShare', listener);
}
