# Guía para Agregar y Subir Partidos del Mundial en FoxPay

Este documento detalla el paso a paso exacto de cómo agregar nuevos partidos al sistema, investigar sus cuotas oficiales de mercado y desplegar los cambios a producción.

---

## Paso 1: Obtener la Información y Buscar las Cuotas Reales
Antes de registrar los partidos, se consultan las cuotas reales promedio que ofrecen las casas de apuestas para los tres resultados posibles en tiempo reglamentario (90 minutos):
*   **Ganador Local (team_a)**
*   **Empate (draw)**
*   **Ganador Visitante (team_b)**

*Ejemplo de cuotas obtenidas:*
*   **Brasil**: `1.80` (Favorito)
*   **Empate**: `3.50`
*   **Noruega**: `4.50` (Underdog)

---

## Paso 2: Registrar los Partidos en el Código del Servidor
Los partidos se insertan en la función `seedWorldCupMatches()` del archivo [server.js](file:///g:/NERAVERSE/NERATAPCOIN/FOXPAY%20MINERADORAS/server.js).

Se añade un nuevo objeto al array `matches` respetando la estructura existente:

```javascript
{ 
  id: 'wc_2026_07_05_1',              // ID único. Formato recomendado: wc_año_mes_dia_numero
  team_a: 'Brasil',                   // Nombre del equipo local
  team_b: 'Noruega',                  // Nombre del equipo visitante
  flag_a: '🇧🇷',                       // Emoji de la bandera del equipo local
  flag_b: '🇳🇴',                       // Emoji de la bandera del equipo visitante
  venue: 'Octavos de Final',          // Fase o estadio
  match_date: '2026-07-05T16:00:00Z', // Fecha y hora oficial en formato ISO UTC
  odds_team_a: 1.80,                  // Cuota decimal para la victoria del equipo local
  odds_draw: 3.50,                    // Cuota decimal para el empate
  odds_team_b: 4.50                   // Cuota decimal para la victoria del equipo visitante
}
```

> [!IMPORTANT]
> El sistema utiliza `insert on conflict (id) do update set...` en la base de datos de Postgres. Esto significa que si agregas un partido con un `id` nuevo se creará, pero si modificas un partido ya existente con su mismo `id`, se actualizarán únicamente las cuotas o la fecha sin resetear su estado (`resolved`, `closed`) ni borrar apuestas ya realizadas.

---

## Paso 3: Subir los Cambios a Producción y Desarrollo con Git
Una vez guardados los cambios en `server.js`, se ejecutan las siguientes instrucciones en la terminal de comandos para subirlo a los servidores:

```bash
# 1. Agregar el archivo modificado
git add server.js

# 2. Hacer el commit con un mensaje descriptivo
git commit -m "feat: seed July 5 World Cup matches with exact odds"

# 3. Empujar los cambios al servidor de producción en la VPS
git push production main

# 4. Empujar los cambios al servidor de desarrollo/pruebas en GitHub
git push origin main
```

---

## Paso 4: Forzar el Despliegue en Coolify
Para que el servidor web VPS cargue y aplique los partidos que acabas de subir:
1.  Ingresa a tu panel de **Coolify**.
2.  Ve a tu proyecto y selecciona la aplicación del juego.
3.  Haz clic en el botón superior derecho **`Deploy`** (o **`Redeploy`**).
4.  Una vez finalice la compilación, el servidor ejecutará automáticamente la función `seedWorldCupMatches()` durante el inicio de la app y los partidos aparecerán de inmediato en los paneles de los usuarios.
