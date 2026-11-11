import { registerRootComponent } from 'expo';

// Os botões dos avisos ("Feito", "Adiar", "Paguei") precisam da tarefa em
// segundo plano definida antes de qualquer outra coisa.
import './src/notificationTask';

// Root lê o visual salvo, aplica as cores e as fontes e depois carrega o App
import Root from './src/Root';

registerRootComponent(Root);
