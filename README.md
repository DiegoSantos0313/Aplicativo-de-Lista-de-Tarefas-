# Lista — aplicativo de tarefas

Aplicativo mobile de tarefas com contas de usuário, prioridades, lembretes locais e sincronização pelo Firebase. Construído com React Native, Expo e JavaScript.

## Requisitos

- Node.js LTS e npm
- Um projeto no [Firebase Console](https://console.firebase.google.com/)
- Expo Go no aparelho para testar

## Configuração

1. Instale as dependências:

   ```bash
   npm install
   ```

2. No Firebase Console, crie um projeto e habilite **Authentication → E-mail/senha** e **Cloud Firestore**.
3. Copie `.env.example` para `.env` e preencha os valores da configuração do seu app web Firebase. As variáveis `EXPO_PUBLIC_*` são incluídas no aplicativo; não coloque senhas, chaves privadas ou credenciais de administrador nelas.
4. Publique as regras de `firestore.rules` no Firestore (aba **Rules**).
5. Inicie o Expo:

   ```bash
   npx expo start
   ```

   Escaneie o QR code com o Expo Go. Para notificações locais, use um aparelho físico e permita notificações quando solicitado.

## Funcionalidades

- Cadastro e login com e-mail e senha; a sessão fica persistida no aparelho.
- Tarefas privadas por usuário, sincronizadas no Firestore.
- Criação, conclusão e exclusão de tarefas com notas opcionais.
- Prioridades alta, média e baixa; tarefas em aberto aparecem primeiro, ordenadas por prioridade.
- Filtros para todas, a fazer e concluídas.
- Lembretes locais opcionais por data e horário. Eles são agendados no aparelho em que a tarefa foi criada.

## Scripts

- `npm start` — abre o servidor de desenvolvimento Expo.
- `npm run android` — inicia no Android.
- `npm run ios` — inicia no iOS (requer macOS para simulador).
- `npm run web` — inicia a versão web; notificações locais são voltadas ao app mobile.
