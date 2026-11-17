export const SPRING_RISE_SECONDS = 0.95;
export const SPRING_HEIGHT_BOXES = 10;

/** Analytic constant-gravity flight: independent from normal jump tuning and frame rate. */
export function springTrajectory (elapsed: number, launchSurface: number, landingSurface: number, boxVisualHeight: number)
{
    const height = SPRING_HEIGHT_BOXES * boxVisualHeight;
    const gravity = 2 * height / (SPRING_RISE_SECONDS ** 2);
    const speed = gravity * SPRING_RISE_SECONDS;
    const rise = launchSurface - landingSurface;
    const landingTime = (speed + Math.sqrt(Math.max(0, speed * speed - 2 * gravity * rise))) / gravity;
    const time = Math.min(elapsed, landingTime);

    return {
        feetY: elapsed >= landingTime ? landingSurface : launchSurface - speed * time + 0.5 * gravity * time * time,
        vy: elapsed >= landingTime ? 0 : -speed + gravity * time,
        rising: time < SPRING_RISE_SECONDS,
        landed: elapsed >= landingTime,
        landingTime,
        height
    };
}

/** All ten deliveries finish at 0.800s, before the 0.950s apex. */
export function springDeliveryProgress (elapsed: number, index: number)
{
    const time = Math.min(1, Math.max(0, (elapsed - 0.096 - index * 0.048) / 0.272));
    return 1 - (1 - time) ** 3;
}
