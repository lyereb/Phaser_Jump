/** Artistic ascent compressed into 0..500 game metres, not real atmospheric altitude. */
export const ALTITUDE_BACKGROUND = {
    endMeters: 500,
    overlap: 0.24,
    smoothingSeconds: 0.65,
    segmentCount: 4,
    moonAnchorY: 0.355
} as const;

export function altitudeProgress (meters: number)
{
    if (!Number.isFinite(meters)) return 0;
    return Math.min(1, Math.max(0, meters / ALTITUDE_BACKGROUND.endMeters));
}

export class AltitudeProgress
{
    private current = 0;
    private target = 0;
    private stopped = false;

    setMeters (meters: number)
    {
        if (!this.stopped) this.target = Math.max(this.target, altitudeProgress(meters));
    }

    update (delta: number)
    {
        if (this.stopped || !Number.isFinite(delta) || delta <= 0) return false;
        const before = this.current;
        const dt = Math.min(50, delta) / 1000;
        this.current += (this.target - this.current) * (1 - Math.exp(-dt / ALTITUDE_BACKGROUND.smoothingSeconds));
        if (this.target - this.current < 0.00001) this.current = this.target;
        return this.current !== before;
    }

    freeze () { this.stopped = true; }
    reset () { this.current = 0; this.target = 0; this.stopped = false; }
    value () { return this.current; }
    status () { return { current: this.current, target: this.target, frozen: this.stopped }; }
}

export function altitudeLayout (width: number, height: number, progress: number)
{
    const panelHeight = Math.max(height, width * 16 / 9);
    const stride = panelHeight * (1 - ALTITUDE_BACKGROUND.overlap);
    const travel = stride * (ALTITUDE_BACKGROUND.segmentCount - 1);
    return { panelHeight, panelWidth: panelHeight * 9 / 16, stride, travel,
        offset: Math.min(1, Math.max(0, progress)) * travel,
        moonShift: (panelHeight - height) * (0.5 - ALTITUDE_BACKGROUND.moonAnchorY) };
}
