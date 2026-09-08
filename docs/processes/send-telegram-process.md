# Proceso: Cómo Enviar un Mensaje por Telegram

## Requisitos previos

1. Necesitas un bot de Telegram. Si no lo tienes: habla con @BotFather, crea un bot y copia su token (gratis).
2. En la página **Telegram**, ve a la pestaña **Bots y Webhook** y agrega el bot (etiqueta + token).
3. Haz clic en **Registrar Webhook en el Bot** para que Telegram envíe al sistema los mensajes que reciba.

## Vincular un Cliente (chat_id)

1. Pídele al cliente que abra Telegram y le escriba `/start` a tu bot.
2. El bot le responderá con su `chat_id` (número de identificación).
3. En **Clientes**, abre la ficha del cliente y pega ese número en el campo **Telegram Chat ID**.
4. Guarda. El cliente ya recibirá notificaciones y recordatorios por Telegram.
5. En la página **Telegram**, el panel "Clientes sin Telegram vinculado" muestra quién falta por vincular y te deja copiar un mensaje de invitación para enviarlo por WhatsApp.

## Enviar Mensaje a un Cliente

1. Ve a **Telegram** en el menú principal.
2. Ingresa el `chat_id` manualmente, selecciona un cliente vinculado, o elige "Enviar a todos".
3. Redacta tu mensaje (puedes adjuntar foto, documento, video o audio).
4. Haz clic en **Enviar por Telegram**.

## Enviar Recordatorio de Pagos Masivo

1. Escribe el mensaje del recordatorio en la página de Telegram.
2. Puedes usar las variables `{cliente}` y `{monto}` para personalizar cada mensaje.
3. Haz clic en **Enviar recordatorios a clientes con saldo**.
4. Solo se envían a clientes con saldo pendiente y Telegram vinculado.