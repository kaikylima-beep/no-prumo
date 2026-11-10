import { registerRootComponent } from 'expo';
// os botões dos avisos precisam da tarefa em segundo plano definida antes de tudo
import './src/background';
import Root from './src/Root';

registerRootComponent(Root);
