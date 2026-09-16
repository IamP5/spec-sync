// PROTOTYPE variant B backdrop — raw WebGL fragment shader: blue light streaks at speed.
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';

const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;
const FRAG = `
precision highp float;
uniform vec2 r; uniform float t; uniform float dark;
float hash(float n){return fract(sin(n)*43758.5453123);}
void main(){
  vec2 uv=gl_FragCoord.xy/r;
  vec2 p=(uv-0.5)*vec2(r.x/r.y,1.0);
  float glow=0.0;
  for(int i=0;i<48;i++){
    float fi=float(i);
    float y=(hash(fi)*2.0-1.0)*0.95;
    float sp=0.35+hash(fi+7.0)*1.1;
    float len=0.25+hash(fi+3.0)*0.9;
    float head=fract(t*sp*0.18+hash(fi+11.0))*(3.2+len)-1.6-len;
    float along=p.x-head;
    float tail=smoothstep(-len,0.0,along)*step(along,0.0);
    float d=abs(p.y-y);
    float w=0.0025+hash(fi+5.0)*0.004;
    glow+=tail*exp(-d*d/(w*w))*(0.35+0.65*hash(fi+13.0));
  }
  vec3 blue=vec3(0.0,0.42,0.94);
  vec3 col=blue*glow+vec3(1.0)*pow(glow,3.0)*0.35;
  float vig=smoothstep(1.4,0.2,length(p*vec2(0.7,1.0)));
  vec3 base=mix(vec3(0.0,0.02,0.10),vec3(0.0,0.035,0.18),vig);
  vec3 outc=mix(vec3(1.0)-col*1.2, base+col, dark);
  float a=mix(clamp(glow*1.5,0.0,1.0)*0.9, 1.0, dark);
  gl_FragColor=vec4(outc,a);
}`;

@Component({
  selector: 'app-home-backdrop-shader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'pointer-events-none absolute inset-0 overflow-hidden',
    'aria-hidden': 'true',
  },
  template: `<canvas #c class="block h-full w-full"></canvas>
    <div
      class="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent"
    ></div>`,
})
export class HomeBackdropShader {
  private readonly canvas =
    viewChild.required<ElementRef<HTMLCanvasElement>>('c');
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => this.start());
  }

  private start(): void {
    const canvas = this.canvas().nativeElement;
    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: false,
    });
    if (!gl) return;
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uR = gl.getUniformLocation(prog, 'r');
    const uT = gl.getUniformLocation(prog, 't');
    const uD = gl.getUniformLocation(prog, 'dark');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    const t0 = performance.now();
    const frame = () => {
      const dpr = Math.min(devicePixelRatio, 1.5);
      const w = Math.floor(canvas.clientWidth * dpr);
      const h = Math.floor(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(uR, w, h);
      gl.uniform1f(uT, reduced ? 12 : (performance.now() - t0) / 1000);
      gl.uniform1f(
        uD,
        document.documentElement.classList.contains('dark') ? 1 : 0,
      );
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!reduced) raf = requestAnimationFrame(frame);
    };
    frame();
    this.destroyRef.onDestroy(() => cancelAnimationFrame(raf));
  }
}
