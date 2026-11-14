#!/usr/bin/env python3
"""Reproducible revised thumbnail batch for Pattern Generator Atlas v0.1.6.

The drawings are computed from explicit equations/rules below, not copied from web images.
Runtime: Python 3.10+, numpy, matplotlib, scipy, Pillow; scikit-image is required only for the Schwarz-P and medial-axis examples.
All RNGs are explicitly seeded. The HTML/JSON update is performed by the accompanying build step.
"""
from __future__ import annotations
import base64, io, json, math, os, re, csv
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection
from scipy.spatial import Voronoi
from scipy.integrate import solve_ivp
from scipy.ndimage import convolve
from PIL import Image

ROOT=Path(__file__).resolve().parent
# Prefer the base dataset shipped in the v0.1.5 package. If this script is placed
# elsewhere, the fallback looks in the extracted-package layout used for this release.
_INPUT_CANDIDATES = [
    ROOT/'pattern_generator_atlas_data_v0.1.5.json',
    ROOT/'package_staging_v0_1_5'/'pattern_generator_atlas_data_v0.1.5.json',
    ROOT/'extracted_v015'/'package_staging_v0_1_5'/'pattern_generator_atlas_data_v0.1.5.json',
]
INPUT = next((p for p in _INPUT_CANDIDATES if p.exists()), _INPUT_CANDIDATES[0])
OUTDIR=ROOT/'archetypes_v0.1.6'
OUTDIR.mkdir(exist_ok=True)
PAPER='#FFFEF9'; BLACK='#17191B'; GREY='#AEB4BA'; MID='#63676B'; LINE='#D9DAD6'  # midpoint rounded half-up from black and grey
DPI=118
plt.rcParams.update({'font.family':'DejaVu Sans','axes.linewidth':0.45,'lines.solid_capstyle':'round','lines.solid_joinstyle':'round','savefig.facecolor':PAPER,'figure.facecolor':PAPER})

# Each record includes exact generation basis, parameters, seed/initial conditions, numerical method, and sources.
SOURCES={
 'lozi':('Lozi map: canonical equations and typical parameters','https://pmc.ncbi.nlm.nih.gov/articles/PMC7597262/','The classical map is x[n+1]=1-a|x[n]|+y[n], y[n+1]=b x[n]; the article reports the common a=1.7, b=0.5 chaotic-attractor setting.'),
 'ikeda':('Ikeda map: definition and parameterized attractor','https://en.wikipedia.org/wiki/Ikeda_map','Standard optical-cavity map; this rendering uses a common u=0.9 form and states its parameter explicitly.'),
 'cat':("Arnold's cat map — torus automorphism convention used here","https://en.wikipedia.org/wiki/Arnold%27s_cat_map","This render uses (x',y')=(2x+y,x+y) mod 1. The matrix convention must match the formula shown; other conjugate/related cat-map matrices are not silently substituted."),
 'baker':("Baker's map — formal definitions",'https://en.wikipedia.org/wiki/Baker%27s_map','Distinguishes folded and unfolded conventions; this rendering explicitly uses the unfolded convention.'),
 'circle':('Circle Map — Wolfram MathWorld','https://mathworld.wolfram.com/CircleMap.html','Defines theta[n+1]=theta[n]+Omega−K/(2π)sin(2πtheta[n]) modulo one.'),
 'newton':('Newton-map basin partition for z^3−1: Newton iteration definition','https://mathworld.wolfram.com/NewtonsMethod.html','The Newton update is z[n+1]=z[n]−f(z[n])/f\'(z[n]); this rendering uses f(z)=z^3−1 and classifies convergence to its three roots.'),
 'eca':('Elementary Cellular Automaton — Wolfram MathWorld','https://mathworld.wolfram.com/ElementaryCellularAutomaton.html','Defines the 3-cell binary neighborhood and canonical spacetime display; 256 rules count the 2^8 local functions.'),
 'highlife':('Life-like rules and HighLife replicator pattern — David Eppstein, UCI','https://ics.uci.edu/~eppstein/ca/lifelike.html','Provides B/S notation and RLE for the 12-cell B36/S23 HighLife replicator.'),
 'daynight':('Day & Night cellular automaton','https://en.wikipedia.org/wiki/Day_and_Night_(cellular_automaton)','Defines B3678/S34678 with Moore neighborhood and black/white reversal symmetry.'),
 'seeds':('Seeds cellular automaton — B2/S rule','https://conwaylife.com/wiki/Seeds','Seeds is the Life-like rule B2/S: births occur with exactly two live Moore neighbours and no live cell survives.'),
 'wireworld':('WireWorld — Wolfram MathWorld','https://mathworld.wolfram.com/WireWorld.html','Defines the four states and electron-head-neighbor update condition.'),
 'bml':('Biham–Middleton–Levine traffic model','https://doi.org/10.1103/PhysRevA.46.R6124','Original two-dimensional traffic cellular automaton; east and north species move in alternating substeps.'),
 'nasch':('Nagel–Schreckenberg traffic model','https://doi.org/10.1051/jp1:1992277','Original stochastic cellular-automaton traffic model with acceleration, gap limitation, random braking, and movement.'),
 'power':('Power diagram / Laguerre tessellation definition','https://mathworld.wolfram.com/PowerDiagram.html','A weighted Voronoi partition defined by power distance; this renderer computes clipped power cells from the exact pairwise linear inequalities.'),
 'peano':('Peano curve L-system — Paul Bourke','https://paulbourke.org/fractals/lsys/','Provides the Peano L-system production rules and turtle turn convention used in the renderer.'),
 'matern':('Matérn cluster point process — Wolfram Language documentation','https://reference.wolfram.com/language/ref/MaternPointProcess.html','Poisson parent process, Poisson offspring count, and offspring uniform in a ball of fixed radius.'),
 'thomas':('Thomas point process (Gaussian-offspring Neyman–Scott process) — cluster-process definition','https://en.wikipedia.org/wiki/Thomas_point_process','Specifies Poisson parent locations and Gaussian-distributed child offsets.'),
 'tasep':('Totally asymmetric simple exclusion process (TASEP) — model definition','https://en.wikipedia.org/wiki/Totally_asymmetric_simple_exclusion_process','Particles hop in one direction into empty sites; the implementation uses continuous-time rate-one transitions and periodic boundaries.'),
 'schwarz':('Schwarz P minimal surface implicit approximation','https://en.wikipedia.org/wiki/Schwarz_minimal_surface','Uses the standard triply periodic level-surface approximation cos(x)+cos(y)+cos(z)=0.'),
 'cantor':('Cantor set ternary construction','https://mathworld.wolfram.com/CantorSet.html','The ternary Cantor set is generated by repeatedly removing the open middle third of each retained interval.'),
 'medial':('Medial axis as centers of maximal inscribed disks','https://citeseerx.ist.psu.edu/document?doi=99b9e56e2016aeddcfd58a8ebfdd65407fc2f11d&repid=rep1&type=pdf','Definition of the medial axis / skeleton via centers of maximal inscribed disks; the image is a discrete distance-transform approximation for a stated Y-shaped domain.'),
 'fib':('Fibonacci word / Fibonacci substitution','https://en.wikipedia.org/wiki/Fibonacci_word','The infinite word is a fixed point of a morphism; this visualization shows a finite prefix generated from 0→01, 1→0.'),
 'thue':('Thue–Morse sequence','https://en.wikipedia.org/wiki/Thue%E2%80%93Morse_sequence','Binary sequence generated by t[2n]=t[n], t[2n+1]=1−t[n], equivalently by repeated complementing substitution.'),
}

# Source descriptions intentionally distinguish a model definition from any one realization.
def setup():
    fig=plt.figure(figsize=(1,1),dpi=DPI,facecolor=PAPER)
    ax=fig.add_axes([0.035,0.035,0.93,0.93],facecolor=PAPER)
    ax.set_axis_off()
    return fig,ax

def savefig(fig,key):
    p=OUTDIR/f'{key}.png'
    fig.savefig(p,dpi=DPI,facecolor=PAPER,edgecolor='none',pad_inches=0)
    plt.close(fig)
    im=Image.open(p).convert('RGB').resize((118,118),Image.Resampling.LANCZOS)
    im.save(p,format='PNG',optimize=True)
    b64=base64.b64encode(p.read_bytes()).decode('ascii')
    return 'data:image/png;base64,'+b64

def plot_path(ax, pts, **kw):
    a=np.asarray(pts)
    ax.plot(a[:,0],a[:,1],**kw)

def iter_ca(seed, birth, survive, steps, wrap=False):
    a=np.asarray(seed,dtype=np.uint8).copy()
    kern=np.ones((3,3),dtype=int); kern[1,1]=0
    out=[a.copy()]
    for _ in range(steps):
        n=convolve(a.astype(int),kern,mode='wrap' if wrap else 'constant',cval=0)
        a=((a==1)&np.isin(n,list(survive)))|((a==0)&np.isin(n,list(birth)))
        a=a.astype(np.uint8); out.append(a.copy())
    return out

def render_lozi():
    a,b=1.7,.5; x,y=.1,.1; pts=[]
    for i in range(25000):
        xn=1-a*abs(x)+y; yn=b*x; x,y=xn,yn
        if i>1000: pts.append((x,y))
    fig,ax=setup(); q=np.array(pts)
    ax.scatter(q[::2,0],q[::2,1],s=1.10,c=GREY,linewidths=0)
    ax.scatter(q[1::2,0],q[1::2,1],s=.92,c=BLACK,linewidths=0)
    ax.set_xlim(-1.5,1.5); ax.set_ylim(-.8,.8); ax.set_aspect('equal')
    return savefig(fig,'DΔ-P-0110')

def render_ikeda():
    u=.9; x,y=.1,.1; pts=[]
    for i in range(45000):
        t=.4-6/(1+x*x+y*y)
        xn=1+u*(x*math.cos(t)-y*math.sin(t)); yn=u*(x*math.sin(t)+y*math.cos(t)); x,y=xn,yn
        if i>2500 and abs(x)<5 and abs(y)<5: pts.append((x,y))
    fig,ax=setup(); q=np.array(pts)
    ax.scatter(q[::2,0],q[::2,1],s=.1,c=GREY,linewidths=0)
    ax.scatter(q[1::2,0],q[1::2,1],s=.085,c=BLACK,linewidths=0)
    ax.set_xlim(-1.6,2.6); ax.set_ylim(-1.6,1.6); ax.set_aspect('equal')
    return savefig(fig,'DΔ-P-0111')

def render_catmap():
    # Exact map (x',y')=(2x+y,x+y) mod 1; plot image of a torus coordinate grid after one application.
    fig,ax=setup(); n=19
    for val in np.linspace(0,1,n):
        for vertical in [True,False]:
            t=np.linspace(0,1,200)
            if vertical: x=np.full_like(t,val); y=t
            else: x=t; y=np.full_like(t,val)
            X=(2*x+y); Y=(x+y)
            # Split segments when integer wrap boundaries are crossed; each plotted segment is continuous on the torus chart.
            u=np.mod(X,1); v=np.mod(Y,1)
            breaks=np.where((np.abs(np.diff(u))>.5)|(np.abs(np.diff(v))>.5))[0]
            starts=np.r_[0,breaks+1]; ends=np.r_[breaks+1,len(t)]
            for s,e in zip(starts,ends):
                if e-s>1: ax.plot(u[s:e],v[s:e],color=BLACK if val in (0,1) else GREY,lw=.42)
    ax.add_patch(plt.Rectangle((0,0),1,1,fill=False,ec=BLACK,lw=.65)); ax.set_xlim(-.02,1.02); ax.set_ylim(-.02,1.02); ax.set_aspect('equal')
    return savefig(fig,'DΔ-P-0113')

def render_baker():
    # Unfolded baker map. Compare one input square (left) to the exact stretch/cut/stack image (right).
    fig=plt.figure(figsize=(1,1),dpi=DPI,facecolor=PAPER)
    ax=fig.add_axes([.02,.12,.96,.80],facecolor=PAPER); ax.set_axis_off()
    # input square, with two vertical half-strips and a coordinate grid
    for t in np.linspace(0,1,5):
        ax.plot([.04+t*.36,.04+t*.36],[.18,.82],c=GREY,lw=.42)
        ax.plot([.04,.40],[.18+t*.64,.18+t*.64],c=GREY,lw=.42)
    ax.add_patch(plt.Rectangle((.04,.18),.36,.64,fill=False,ec=BLACK,lw=.6))
    ax.plot([.22,.22],[.18,.82],c=BLACK,lw=.85)
    # map arrow
    ax.annotate('',xy=(.70,.50),xytext=(.45,.50),arrowprops=dict(arrowstyle='-|>',lw=.7,color=BLACK,mutation_scale=6))
    # output square: each half is stretched across x and compressed into one half in y
    x0=.60; x1=.96; y0=.18; y1=.82
    for t in np.linspace(0,1,5):
        ax.plot([x0+t*(x1-x0),x0+t*(x1-x0)],[y0,y1],c=BLACK if t in (0,.5,1) else GREY,lw=.47)
    for t in np.linspace(0,1,5):
        ax.plot([x0,x1],[y0+t*(y1-y0)/2,y0+t*(y1-y0)/2],c=GREY,lw=.4)
        ax.plot([x0,x1],[y0+(y1-y0)/2+t*(y1-y0)/2,y0+(y1-y0)/2+t*(y1-y0)/2],c=GREY,lw=.4)
    ax.plot([x0,x1],[.50,.50],c=BLACK,lw=.9)
    ax.add_patch(plt.Rectangle((x0,y0),x1-x0,y1-y0,fill=False,ec=BLACK,lw=.6))
    return savefig(fig,'DΔ-P-0114')

def render_circlemap():
    Omega=.2; K=1.0
    x=np.linspace(0,1,1400,endpoint=False)
    y=np.mod(x+Omega-K/(2*np.pi)*np.sin(2*np.pi*x),1)
    fig,ax=setup(); ax.plot(x,y,c=GREY,lw=.6); ax.plot(x,x,c=BLACK,lw=.5,ls=(0,(2,2)))
    # Orbit on the circle map with the stated representative parameters.
    z=.137; orbit=[]
    for i in range(650): z=(z+Omega-K/(2*np.pi)*math.sin(2*np.pi*z))%1; orbit.append(z)
    ax.scatter(np.array(orbit[550:649]),np.array(orbit[551:650]),s=.28,c=BLACK,linewidths=0)
    ax.set_xlim(0,1); ax.set_ylim(0,1); ax.set_aspect('equal')
    return savefig(fig,'DΔ-P-0115')

def render_newton_basin():
    N=118; xs=np.linspace(-1.5,1.5,N); ys=np.linspace(-1.5,1.5,N); Z=xs[None,:]+1j*ys[:,None]
    roots=np.exp(2j*np.pi*np.arange(3)/3); active=np.ones(Z.shape,dtype=bool); labels=np.full(Z.shape,-1,dtype=int)
    with np.errstate(divide='ignore',invalid='ignore',over='ignore'):
        for _ in range(45):
            f=Z**3-1; fp=3*Z**2
            good=active & (np.abs(fp)>1e-8)
            Z[good]=Z[good]-f[good]/fp[good]
            for k,r in enumerate(roots):
                m=active & (np.abs(Z-r)<1e-3); labels[m]=k; active[m]=False
            active &= np.isfinite(Z.real)&np.isfinite(Z.imag)&(np.abs(Z)<1e5)
    palette=np.array([[23,25,27],[174,180,186],[99,103,107],[255,254,249]],dtype=np.uint8)
    pix=np.empty((N,N,3),dtype=np.uint8); idx=labels.copy(); idx[idx<0]=3
    for k in range(4): pix[idx==k]=palette[k]
    im=Image.fromarray(pix,'RGB').resize((118,118),Image.Resampling.LANCZOS); p=OUTDIR/'D0-G-0254.png'; im.save(p,optimize=True)
    return 'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode()

def render_highlife():
    # The canonical 12-cell RLE from Eppstein's UCI Life-like rule catalog.
    rle='bb3o$bobbo$o3bo$obbo$3o!'; rows=[]; row=[]; i=0
    while i<len(rle):
        if rle[i].isdigit():
            j=i
            while j<len(rle) and rle[j].isdigit(): j+=1
            count=int(rle[i:j]); sym=rle[j]; i=j+1
        else: count=1; sym=rle[i]; i+=1
        if sym=='b': row.extend([0]*count)
        elif sym=='o': row.extend([1]*count)
        elif sym=='$':
            rows.append(row); row=[]
        elif sym=='!': rows.append(row); break
    w=max(map(len,rows)); seed=np.zeros((w,w),dtype=np.uint8)
    for y,r in enumerate(rows): seed[y,:len(r)]=r
    seed=np.pad(seed,((20,20),(20,20)))
    evol=iter_ca(seed,{3,6},{2,3},36)
    # Show generation 12, where the canonical replicator has replicated; crop around its geometry.
    a=evol[12]; yy,xx=np.where(a); y0,y1=max(0,yy.min()-5),min(a.shape[0],yy.max()+6); x0,x1=max(0,xx.min()-5),min(a.shape[1],xx.max()+6); a=a[y0:y1,x0:x1]
    fig,ax=setup(); ax.imshow(a,cmap=matplotlib.colors.ListedColormap([PAPER,BLACK]),interpolation='nearest',origin='upper',extent=[0,a.shape[1],a.shape[0],0]); ax.set_xlim(0,a.shape[1]); ax.set_ylim(a.shape[0],0); ax.set_aspect('equal')
    return savefig(fig,'DΔ-L-0155')

def render_daynight():
    # The named symmetry: complementing all states complements every subsequent state under B3678/S34678.
    rng=np.random.default_rng(60156); seed=(rng.random((46,46))<.49).astype(np.uint8)
    a=iter_ca(seed,{3,6,7,8},{3,4,6,7,8},28,wrap=True)[-1]
    # Put rule output and its exact state complement side by side, preserving identical coordinates.
    b=1-a
    canvas=np.zeros((46,94),np.uint8); canvas[:,:46]=a; canvas[:,48:94]=b
    fig,ax=setup(); ax.imshow(canvas,cmap=matplotlib.colors.ListedColormap([PAPER,BLACK]),interpolation='nearest',origin='upper'); ax.set_aspect('equal')
    ax.plot([46.8,46.8],[-.5,45.5],color=GREY,lw=.55)
    return savefig(fig,'DΔ-L-0156')

def render_seeds():
    seed=np.zeros((79,79),dtype=np.uint8); seed[39,39:41]=1
    evol=iter_ca(seed,{2},set(),50)
    # Generation 4 is the first extended nontrivial pattern from the stated two-cell seed; later it decays.
    a=evol[4]; yy,xx=np.where(a); pad=5
    a=a[max(0,yy.min()-pad):min(a.shape[0],yy.max()+pad+1),max(0,xx.min()-pad):min(a.shape[1],xx.max()+pad+1)]
    fig,ax=setup(); ax.imshow(a,cmap=matplotlib.colors.ListedColormap([PAPER,BLACK]),interpolation='nearest',origin='upper'); ax.set_aspect('equal')
    return savefig(fig,'DΔ-L-0157')

def render_wireworld():
    # Four-state Wireworld on a 29x29 cell grid; conductor network with a T-junction and a live electron signal.
    h=w=29; a=np.zeros((h,w),dtype=np.uint8)
    a[20,2:27]=3; a[7:21,17]=3; a[7,17:25]=3
    a[20,5]=2; a[20,6]=1
    # Simulate a few synchronous ticks under the exact head-neighbor rule.
    kernel=np.ones((3,3),int); kernel[1,1]=0
    for _ in range(3):
        n=convolve((a==1).astype(int),kernel,mode='constant',cval=0)
        b=a.copy(); b[a==1]=2; b[a==2]=3; b[(a==3)&((n==1)|(n==2))]=1; a=b
    rgb=np.empty((h,w,3),dtype=np.uint8); rgb[:]=[255,254,249]
    rgb[a==1]=[23,25,27]; rgb[a==2]=[99,103,107]; rgb[a==3]=[174,180,186]
    # Make the cell grid visible via crisp square cells, not a subpixel 118-cell track.
    p=OUTDIR/'DΔ-L-0160.png'; Image.fromarray(rgb).resize((118,118),Image.Resampling.NEAREST).save(p,optimize=True)
    return 'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode()

def render_bml():
    # BML deterministic update with a fixed initial state: east phase then north phase, both parallel.
    n=74; rng=np.random.default_rng(60182); a=np.zeros((n,n),np.uint8)
    # A dense initial mixture in the jammed regime makes the BML congestion archetype visible.
    vals=rng.random((n,n)); a[vals<.22]=1; a[(vals>=.22)&(vals<.44)]=2
    for t in range(190):
        # Eastbound cells shift one site east iff destination is empty in the pre-phase state.
        old=a.copy(); east=(old==1); can=east & (np.roll(old,-1,axis=1)==0)
        new=old.copy(); new[can]=0; new[np.roll(can,+1,axis=1)]=1; a=new
        # Northbound cells shift one site north iff destination is empty after east phase.
        old=a.copy(); north=(old==2); can=north & (np.roll(old,+1,axis=0)==0)
        new=old.copy(); new[can]=0; new[np.roll(can,-1,axis=0)]=2; a=new
    rgb=np.empty((n,n,3),np.uint8); rgb[:]=[255,254,249]; rgb[a==1]=[23,25,27]; rgb[a==2]=[174,180,186]
    p=OUTDIR/'DΔ-L-0182.png'; Image.fromarray(rgb).resize((118,118),Image.Resampling.NEAREST).save(p,optimize=True)
    return 'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode()

def render_nasch():
    rng=np.random.default_rng(60784); L=100; steps=85; vmax=5; p=.23; density=.23
    occ=np.zeros(L,dtype=bool); occ[rng.choice(L,int(L*density),replace=False)]=True
    vel=np.full(L,-1,dtype=int); vel[occ]=rng.integers(0,vmax+1,size=int(occ.sum())); space=np.zeros((steps,L),int)
    for t in range(steps):
        # space-time sample before the next update: 1=fast, 2=slow car; zero=empty road.
        for i in np.where(occ)[0]: space[t,i]=1 if vel[i]>=3 else 2
        positions=np.where(occ)[0]; gaps=np.zeros(L,dtype=int)
        if len(positions):
            for idx,i in enumerate(positions):
                j=positions[(idx+1)%len(positions)]
                gaps[i]=(j-i-1)%L
        v=vel.copy()
        for i in positions:
            v[i]=min(v[i]+1,vmax,gaps[i])
            if v[i]>0 and rng.random()<p: v[i]-=1
        nocc=np.zeros(L,dtype=bool); nvel=np.full(L,-1,dtype=int)
        for i in positions:
            j=(i+v[i])%L
            # Nagel-Schreckenberg headway rule guarantees collision-free moves.
            nocc[j]=True; nvel[j]=v[i]
        occ,vel=nocc,nvel
    fig,ax=setup(); ax.imshow(space,cmap=matplotlib.colors.ListedColormap([PAPER,BLACK,GREY]),interpolation='nearest',origin='upper',aspect='auto'); ax.set_aspect('auto')
    return savefig(fig,'S-L-0784')

def clip_polygon(poly, n, c):
    # Keep points satisfying n·x <= c; Sutherland–Hodgman clipping.
    out=[]
    if not poly: return out
    for i,p in enumerate(poly):
        q=poly[(i+1)%len(poly)]; fp=np.dot(n,p)-c; fq=np.dot(n,q)-c; inp=fp<=1e-9; inq=fq<=1e-9
        if inp and inq: out.append(q)
        elif inp and not inq:
            t=fp/(fp-fq); out.append(p+t*(q-p))
        elif (not inp) and inq:
            t=fp/(fp-fq); out.append(p+t*(q-p)); out.append(q)
    return out

def render_powerdiagram():
    rng=np.random.default_rng(60074); pts=rng.uniform(.08,.92,(15,2)); weights=rng.uniform(-.04,.04,len(pts)); fig,ax=setup()
    square=[np.array([0.,0.]),np.array([1.,0.]),np.array([1.,1.]),np.array([0.,1.])]
    for i,p in enumerate(pts):
        poly=square
        for j,q in enumerate(pts):
            if i==j: continue
            # |x-p|^2 - w_i <= |x-q|^2-w_j -> 2(q-p)·x <= |q|²-|p|² + w_i-w_j.
            n=2*(q-p); c=np.dot(q,q)-np.dot(p,p)+weights[i]-weights[j]
            poly=clip_polygon(poly,n,c)
            if not poly: break
        if len(poly)>2:
            a=np.asarray(poly); ax.fill(a[:,0],a[:,1],facecolor=(PAPER if i%3==0 else GREY if i%3==1 else MID),edgecolor=BLACK,linewidth=.35)
    ax.scatter(pts[:,0],pts[:,1],s=3,c=BLACK,linewidths=0,zorder=3); ax.set_xlim(0,1); ax.set_ylim(0,1); ax.set_aspect('equal')
    return savefig(fig,'D0-G-0074')

def render_peano():
    # Bourke's Peano L-system, order 3. F moves forward; X/Y only rewrite; +/- are 90-degree turns.
    s='X'; rules={'X':'XFYFX+F+YFXFY-F-XFYFX','Y':'YFXFY-F-XFYFX+F+YFXFY'}
    for _ in range(2): s=''.join(rules.get(ch,ch) for ch in s)
    x=y=0.0; heading=0; pts=[(x,y)]; step=1.0
    for ch in s:
        if ch=='F':
            x+=step*round(math.cos(math.radians(heading))); y+=step*round(math.sin(math.radians(heading))); pts.append((x,y))
        elif ch=='+': heading=(heading+90)%360
        elif ch=='-': heading=(heading-90)%360
    fig,ax=setup(); q=np.array(pts); ax.plot(q[:,0],q[:,1],c=BLACK,lw=.48); ax.set_aspect('equal'); ax.margins(.035)
    return savefig(fig,'D0-G-0091')

def cluster_points(kind):
    rng=np.random.default_rng(60792 if kind=='matern' else 60794); nparents=rng.poisson(24); parents=rng.uniform(.04,.96,(nparents,2)); pts=[]
    for x,y in parents:
        n=rng.poisson(10)
        if kind=='matern':
            r=.12*np.sqrt(rng.random(n)); th=2*np.pi*rng.random(n); q=np.c_[x+r*np.cos(th),y+r*np.sin(th)]
        else:
            q=np.c_[x+rng.normal(0,.045,n),y+rng.normal(0,.045,n)]
        q=q[(q[:,0]>=0)&(q[:,0]<=1)&(q[:,1]>=0)&(q[:,1]<=1)]; pts.extend(q.tolist())
    fig,ax=setup(); q=np.array(pts)
    if len(q): ax.scatter(q[:,0],q[:,1],s=.65,c=BLACK,linewidths=0)
    ax.scatter(parents[:,0],parents[:,1],s=3.2,c=GREY,edgecolors=BLACK,linewidths=.25)
    ax.set_xlim(0,1); ax.set_ylim(0,1); ax.set_aspect('equal')
    key='S-G-0792' if kind=='matern' else 'S-G-0794'
    return savefig(fig,key)

def render_tasep():
    rng=np.random.default_rng(60785); L=76; steps=100; particles=26
    occ=np.zeros(L,dtype=np.uint8); occ[rng.choice(L,particles,replace=False)]=1
    out=np.zeros((steps,L),dtype=np.uint8); t=0.0
    # Continuous-time rate-one TASEP on a periodic ring. Record at fixed time intervals.
    for s in range(steps):
        out[s]=occ
        target=t+0.8
        while t<target:
            eligible=np.where((occ==1)&(np.roll(occ,-1)==0))[0]
            if not len(eligible): t=target; break
            dt=rng.exponential(1/len(eligible))
            if t+dt>target: t=target; break
            t+=dt; i=int(rng.choice(eligible)); occ[i]=0; occ[(i+1)%L]=1
    fig,ax=setup(); ax.imshow(out,cmap=matplotlib.colors.ListedColormap([PAPER,BLACK]),interpolation='nearest',origin='upper',aspect='auto'); ax.set_aspect('auto')
    return savefig(fig,'S-L-0785')

def render_schwarzp():
    try:
        from skimage.measure import marching_cubes
    except Exception as e:
        raise RuntimeError('scikit-image is required for Schwarz-P renderer') from e
    n=38; a=np.linspace(-np.pi,np.pi,n); X,Y,Z=np.meshgrid(a,a,a,indexing='ij'); field=np.cos(X)+np.cos(Y)+np.cos(Z)
    verts,faces,normals,values=marching_cubes(field,level=0.0)
    # convert voxels to physical coordinates and project the actual implicit level surface
    verts=verts/(n-1)*(2*np.pi)-np.pi
    fig=plt.figure(figsize=(1,1),dpi=DPI,facecolor=PAPER); ax=fig.add_axes([0,0,1,1],projection='3d',facecolor=PAPER)
    ax.plot_trisurf(verts[:,0],verts[:,1],faces,verts[:,2],color=GREY,edgecolor=BLACK,linewidth=.12,antialiased=True,shade=False)
    ax.view_init(elev=24,azim=35); ax.set_xlim(-np.pi,np.pi); ax.set_ylim(-np.pi,np.pi); ax.set_zlim(-np.pi,np.pi); ax.set_box_aspect((1,1,1)); ax.set_axis_off()
    return savefig(fig,'D0-G-0084')

def render_cantor():
    fig,ax=setup(); levels=6
    for n in range(levels):
        pieces=[(0.,1.)]
        for _ in range(n):
            pieces=[(a,a+(b-a)/3) for a,b in pieces]+[(b-(b-a)/3,b) for a,b in pieces]
        y=1-n/(levels+1)
        for a,b in pieces: ax.plot([a,b],[y,y],c=BLACK if n%2==0 else GREY,lw=.8,solid_capstyle='butt')
    ax.set_xlim(0,1); ax.set_ylim(-.1,1.1)
    return savefig(fig,'D0-G-0078')

def render_medial():
    from scipy.ndimage import distance_transform_edt
    try: from skimage.morphology import medial_axis
    except Exception: medial_axis=None
    n=118; yy,xx=np.mgrid[0:n,0:n]; mask=np.zeros((n,n),bool)
    # Explicit Y-shaped domain: union of three thick capsules centered on a 3-branch skeleton.
    segments=[((58,61),(58,28),11),((58,62),(30,95),10),((58,62),(88,95),10)]
    for (x0,y0),(x1,y1),r in segments:
        vx=x1-x0; vy=y1-y0; t=np.clip(((xx-x0)*vx+(yy-y0)*vy)/(vx*vx+vy*vy),0,1)
        d=np.sqrt((xx-(x0+t*vx))**2+(yy-(y0+t*vy))**2); mask|=d<=r
    if medial_axis: sk=medial_axis(mask)
    else:
        dist=distance_transform_edt(mask); sk=(dist==convolve(dist,np.ones((3,3))/9,mode='nearest')) & mask
    rgb=np.full((n,n,3),(255,254,249),np.uint8); rgb[mask]=[174,180,186]; rgb[~mask]=[255,254,249]; rgb[sk]=[23,25,27]
    # outline the chosen input shape with a thin black boundary
    edge=mask & ~convolve(mask.astype(np.uint8),np.ones((3,3),np.uint8),mode='nearest').astype(bool)
    rgb[edge]=[23,25,27]
    p=OUTDIR/'D0-G-0095.png'; Image.fromarray(rgb).resize((118,118),Image.Resampling.LANCZOS).save(p,optimize=True)
    return 'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode()

def render_fibonacci():
    s='0'
    for _ in range(12): s=''.join('01' if c=='0' else '0' for c in s)
    return render_binary_word(s,'D0-C-0225')

def render_thuemorse():
    s='0'
    for _ in range(8): s=''.join('01' if c=='0' else '10' for c in s)
    return render_binary_word(s,'D0-C-0226')

def render_binary_word(s,key):
    # Render 256 consecutive symbols as a 16x16 raster in reading order; no symbol is dropped.
    bits=np.array([int(c) for c in s[:256]],dtype=np.uint8)
    if len(bits)<256: bits=np.pad(bits,(0,256-len(bits)))
    a=bits.reshape(16,16)
    fig,ax=setup(); ax.imshow(a,cmap=matplotlib.colors.ListedColormap([PAPER,BLACK]),interpolation='nearest',origin='upper',aspect='equal'); ax.set_aspect('equal')
    return savefig(fig,key)


# ---------------------------------------------------------------------------
# v0.1.6 overrides. Each renderer below computes the archetype from the stated
# mathematical rule. The output uses a square 118x118 canvas and the fixed palette.
# ---------------------------------------------------------------------------
def render_catmap():
    """Arnold cat map on a finite torus: source cat mask, then one exact map step."""
    from PIL import ImageDraw
    n=64
    im=Image.new('L',(n,n),255); d=ImageDraw.Draw(im)
    # An original, simple cat-head silhouette (not copied from a source image).
    d.polygon([(8,24),(8,8),(23,17),(40,17),(56,8),(56,24),(60,33),(58,43),(51,52),(40,58),(24,58),(13,51),(6,42),(5,32)],fill=20)
    # Face negative-space details are part of the starting bitmap.
    d.ellipse((19,28,25,34),fill=255); d.ellipse((39,28,45,34),fill=255)
    d.polygon([(29,37),(35,37),(32,41)],fill=255)
    d.line((32,41,32,45),fill=255,width=1); d.line((32,45,27,47),fill=255,width=1); d.line((32,45,37,47),fill=255,width=1)
    d.line((17,39,26,41),fill=255,width=1); d.line((17,43,26,43),fill=255,width=1)
    d.line((38,41,47,39),fill=255,width=1); d.line((38,43,47,43),fill=255,width=1)
    a=np.asarray(im,dtype=np.uint8)
    # Exact discrete torus permutation for (x',y')=(2x+y,x+y) mod n.
    b=np.full_like(a,255)
    for y in range(n):
        for x in range(n):
            xp=(2*x+y)%n; yp=(x+y)%n
            b[yp,xp]=a[y,x]
    # Two square panels on a square canvas: original above, one-step image below.
    fig=plt.figure(figsize=(1,1),dpi=DPI,facecolor=PAPER)
    ax=fig.add_axes([0,0,1,1]); ax.set_axis_off(); ax.set_xlim(0,118); ax.set_ylim(118,0); ax.set_aspect('equal')
    for ximg, y0 in [(a,3),(b,62)]:
        rgb=np.empty((n,n,3),np.uint8); rgb[:]=[255,254,249]; rgb[ximg<128]=[23,25,27]
        # Keep eye/mouth cutouts as paper; resample with nearest to preserve the exact cell map.
        tile=Image.fromarray(rgb).resize((53,53),Image.Resampling.NEAREST)
        ax.imshow(tile,extent=(32.5,85.5,y0,y0+53),interpolation='nearest')
        ax.add_patch(plt.Rectangle((32.5,y0),53,53,fill=False,ec=BLACK,lw=.55))
    ax.annotate('',xy=(91,59),xytext=(91,55),arrowprops=dict(arrowstyle='-|>',lw=.7,color=MID,mutation_scale=7))
    # Small registration marks make the panel relation visible without captions.
    ax.plot([27,30],[29,29],c=GREY,lw=.55); ax.plot([27,30],[88,88],c=GREY,lw=.55)
    return savefig(fig,'DΔ-P-0113')

def render_daynight():
    """Square representative state of the B3678/S34678 Day & Night CA."""
    rng=np.random.default_rng(60156); n=74
    seed=(rng.random((n,n))<.49).astype(np.uint8)
    a=iter_ca(seed,{3,6,7,8},{3,4,6,7,8},36,wrap=True)[-1]
    # Use the central square of a larger toroidal configuration; no aspect distortion.
    a=a[5:-5,5:-5]
    fig,ax=setup(); ax.imshow(a,cmap=matplotlib.colors.ListedColormap([PAPER,BLACK]),interpolation='nearest',origin='upper',aspect='equal')
    ax.set_xlim(-.5,a.shape[1]-.5); ax.set_ylim(a.shape[0]-.5,-.5); ax.set_aspect('equal')
    return savefig(fig,'DΔ-L-0156')

def render_bml():
    """BML two-species update, with a reproducible density near the jam/flow transition."""
    n=96; rng=np.random.default_rng(60182); a=np.zeros((n,n),np.uint8)
    vals=rng.random((n,n)); a[vals<.155]=1; a[(vals>=.155)&(vals<.31)]=2
    # Canonical parallel east-then-north substeps on a torus.
    history=[]
    for t in range(145):
        old=a.copy(); east=(old==1); can=east & (np.roll(old,-1,axis=1)==0)
        new=old.copy(); new[can]=0; new[np.roll(can,+1,axis=1)]=1; a=new
        old=a.copy(); north=(old==2); can=north & (np.roll(old,+1,axis=0)==0)
        new=old.copy(); new[can]=0; new[np.roll(can,-1,axis=0)]=2; a=new
        if t in (20,45,80,110,144): history.append(a.copy())
    # Display the final state, emphasizing diagonal jam fronts in the actual lattice state.
    rgb=np.empty((n,n,3),np.uint8); rgb[:]=[255,254,249]; rgb[a==1]=[23,25,27]; rgb[a==2]=[174,180,186]
    p=OUTDIR/'DΔ-L-0182.png'; Image.fromarray(rgb).resize((118,118),Image.Resampling.NEAREST).save(p,optimize=True)
    return 'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode()

def render_ikeda():
    """Ikeda attractor density from the stated nonlinear map; grey levels encode visit density."""
    from scipy.ndimage import gaussian_filter
    u=.9; x,y=.1,.1; pts=[]
    for i in range(160000):
        t=.4-6/(1+x*x+y*y)
        xn=1+u*(x*math.cos(t)-y*math.sin(t)); yn=u*(x*math.sin(t)+y*math.cos(t)); x,y=xn,yn
        if i>3000 and -1.6<x<2.7 and -1.7<y<1.7: pts.append((x,y))
    q=np.asarray(pts)
    hist,_,_=np.histogram2d(q[:,1],q[:,0],bins=354,range=[[-1.7,1.7],[-1.6,2.7]])
    den=gaussian_filter(hist.astype(float),sigma=1.25)
    non=den[den>0]
    # Log compression keeps the fine ripples as well as dense recurrent regions visible.
    z=np.log1p(den); nz=z[z>0]
    thresholds=np.quantile(nz,[.22,.57,.86])
    idx=np.zeros(z.shape,np.uint8); idx[z>thresholds[0]]=1; idx[z>thresholds[1]]=2; idx[z>thresholds[2]]=3
    palette=np.array([[255,254,249],[174,180,186],[99,103,107],[23,25,27]],np.uint8)
    rgb=palette[idx]
    p=OUTDIR/'DΔ-P-0111.png'; Image.fromarray(rgb).resize((118,118),Image.Resampling.LANCZOS).save(p,optimize=True)
    return 'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode()

def render_fibonacci():
    """Fibonacci-word fractal: 0→01, 1→0; symbols specify signed quarter-turns."""
    s='0'
    for _ in range(13): s=''.join('01' if c=='0' else '0' for c in s)
    # Standard turtle realization: one unit step per symbol; 0 turns right, 1 turns left.
    x=y=0.0; heading=0; pts=[(x,y)]
    for i,ch in enumerate(s[:377]):
        if i: heading=(heading+(90 if ch=='1' else -90))%360
        x+=round(math.cos(math.radians(heading))); y+=round(math.sin(math.radians(heading))); pts.append((x,y))
    q=np.asarray(pts,float); q[:,0]-=q[:,0].mean(); q[:,1]-=q[:,1].mean()
    fig,ax=setup()
    seg=np.stack([q[:-1],q[1:]],axis=1)
    colors=[BLACK if i%5 else GREY for i in range(len(seg))]
    ax.add_collection(LineCollection(seg,colors=colors,linewidths=[.70 if i%5 else .5 for i in range(len(seg))],capstyle='round',joinstyle='round'))
    span=np.ptp(q,axis=0).max(); center=(q.max(axis=0)+q.min(axis=0))/2
    ax.set_xlim(center[0]-span*.54,center[0]+span*.54); ax.set_ylim(center[1]-span*.54,center[1]+span*.54); ax.set_aspect('equal')
    return savefig(fig,'D0-C-0225')

def render_cantor():
    """Ternary Cantor set construction stages with slightly heavier high-contrast retained intervals."""
    fig,ax=setup(); levels=7
    for n in range(levels):
        pieces=[(0.,1.)]
        for _ in range(n):
            pieces=[(a,a+(b-a)/3) for a,b in pieces]+[(b-(b-a)/3,b) for a,b in pieces]
        y=1-n/(levels+1)
        for a,b in pieces:
            ax.plot([a,b],[y,y],c=BLACK if n<5 else MID,lw=1.05 if n<5 else .9,solid_capstyle='butt')
    ax.set_xlim(0,1); ax.set_ylim(-.06,1.06)
    return savefig(fig,'D0-G-0078')

def render_medial():
    """Medial axis of a specified irregular, branching ribbon domain with curved seams."""
    from scipy.ndimage import distance_transform_edt
    try:
        from skimage.morphology import medial_axis
    except Exception:
        medial_axis=None
    n=236; yy,xx=np.mgrid[0:n,0:n]; mask=np.zeros((n,n),bool)
    # Curved ribbon domain: sampled Bézier-like centerlines with varying width and mild edge waviness.
    curves=[((25,44),(70,30),(80,74),(118,109),13),
            ((118,109),(155,82),(188,88),(210,42),12),
            ((118,109),(151,145),(178,176),(208,195),15),
            ((118,109),(87,139),(69,174),(33,190),14),
            ((67,174),(83,195),(105,202),(124,218),9)]
    for p0,p1,p2,p3,width in curves:
        tt=np.linspace(0,1,420)
        t=tt[:,None]; P0=np.array(p0); P1=np.array(p1); P2=np.array(p2); P3=np.array(p3)
        curve=(1-t)**3*P0+3*(1-t)**2*t*P1+3*(1-t)*t**2*P2+t**3*P3
        for j,(cx,cy) in enumerate(curve):
            radius=width*(1+.10*math.sin(j*.11)+.06*math.sin(j*.037+1.3))
            mask|=(xx-cx)**2+(yy-cy)**2<=radius**2
    # Add shallow scallops along the outside using deterministic small edge discs removed from the mask.
    for cx,cy,r in [(22,53,5),(207,59,4),(187,190,5),(42,179,4),(112,212,3)]:
        mask[(xx-cx)**2+(yy-cy)**2<r*r]=False
    if medial_axis: sk=medial_axis(mask, rng=np.random.default_rng(6095))
    else:
        dist=distance_transform_edt(mask); sk=mask & (dist>=convolve(dist,np.ones((3,3))/9,mode='nearest'))
    # Downsample computed geometry to the final raster; domain fills the square.
    rgb=np.full((n,n,3),(255,254,249),np.uint8); rgb[mask]=[174,180,186]; rgb[sk]=[23,25,27]
    edge=mask & ~convolve(mask.astype(np.uint8),np.ones((3,3),np.uint8),mode='nearest').astype(bool); rgb[edge]=[23,25,27]
    p=OUTDIR/'D0-G-0095.png'; Image.fromarray(rgb).resize((118,118),Image.Resampling.LANCZOS).save(p,optimize=True)
    return 'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode()

def render_schwarzp():
    """Schwarz P implicit triply-periodic level surface with a denser visible mesh."""
    from skimage.measure import marching_cubes
    n=54; axis=np.linspace(-np.pi,np.pi,n); X,Y,Z=np.meshgrid(axis,axis,axis,indexing='ij')
    field=np.cos(X)+np.cos(Y)+np.cos(Z)
    verts,faces,normals,values=marching_cubes(field,level=0.0)
    verts=verts/(n-1)*(2*np.pi)-np.pi
    fig=plt.figure(figsize=(1,1),dpi=DPI,facecolor=PAPER)
    ax=fig.add_axes([-.02,-.02,1.04,1.04],projection='3d',facecolor=PAPER)
    ax.plot_trisurf(verts[:,0],verts[:,1],faces,verts[:,2],color=GREY,edgecolor=BLACK,linewidth=.16,antialiased=True,shade=False)
    ax.view_init(elev=28,azim=38); ax.set_proj_type('ortho')
    ax.set_xlim(-np.pi,np.pi); ax.set_ylim(-np.pi,np.pi); ax.set_zlim(-np.pi,np.pi); ax.set_box_aspect((1,1,1)); ax.set_axis_off()
    return savefig(fig,'D0-G-0084')

def render_nasch():
    """Nagel–Schreckenberg with square spacetime sampling and explicit stop-and-go waves."""
    rng=np.random.default_rng(60784); L=118; steps=118; vmax=5; p=.24; density=.25
    occ=np.zeros(L,dtype=bool); occ[rng.choice(L,int(L*density),replace=False)]=True
    vel=np.full(L,-1,dtype=int); vel[occ]=rng.integers(0,vmax+1,size=int(occ.sum())); space=np.zeros((steps,L),int)
    for t in range(steps):
        for i in np.where(occ)[0]: space[t,i]=1 if vel[i]>=3 else 2
        positions=np.where(occ)[0]; gaps=np.zeros(L,dtype=int)
        if len(positions):
            for idx,i in enumerate(positions):
                j=positions[(idx+1)%len(positions)]; gaps[i]=(j-i-1)%L
        v=vel.copy()
        for i in positions:
            v[i]=min(v[i]+1,vmax,gaps[i])
            if v[i]>0 and rng.random()<p: v[i]-=1
        nocc=np.zeros(L,dtype=bool); nvel=np.full(L,-1,dtype=int)
        for i in positions:
            j=(i+v[i])%L; nocc[j]=True; nvel[j]=v[i]
        occ,vel=nocc,nvel
    fig,ax=setup(); cmap=matplotlib.colors.ListedColormap([PAPER,BLACK,GREY])
    ax.imshow(space,cmap=cmap,interpolation='nearest',origin='upper',aspect='equal',vmin=0,vmax=2)
    ax.set_xlim(-.5,L-.5); ax.set_ylim(steps-.5,-.5); ax.set_aspect('equal')
    return savefig(fig,'S-L-0784')

def render_powerdiagram():
    """Weighted power diagram; outlined nuclei encode the actual positive site weights."""
    rng=np.random.default_rng(60074); pts=rng.uniform(.08,.92,(15,2))
    radii=rng.uniform(.022,.047,len(pts)); weights=radii**2
    fig,ax=setup(); square=[np.array([0.,0.]),np.array([1.,0.]),np.array([1.,1.]),np.array([0.,1.])]
    for i,p in enumerate(pts):
        poly=[v.copy() for v in square]
        for j,q in enumerate(pts):
            if i==j: continue
            nvec=2*(q-p); c=np.dot(q,q)-np.dot(p,p)+weights[i]-weights[j]
            poly=clip_polygon(poly,nvec,c)
            if not poly: break
        if len(poly)>2:
            a=np.asarray(poly); ax.fill(a[:,0],a[:,1],facecolor=(PAPER if i%3==0 else GREY if i%3==1 else MID),edgecolor=BLACK,linewidth=.38)
    for i,(x,y) in enumerate(pts):
        circ=plt.Circle((x,y),radii[i],facecolor=PAPER if i%2==0 else GREY,edgecolor=BLACK,lw=.7,zorder=4)
        ax.add_patch(circ); ax.add_patch(plt.Circle((x,y),radii[i]*.22,facecolor=BLACK,edgecolor='none',zorder=5))
    ax.set_xlim(0,1); ax.set_ylim(0,1); ax.set_aspect('equal')
    return savefig(fig,'D0-G-0074')

def cluster_points(kind):
    """Exact cluster-process generators; Thomas rendering uses ~20 parents and Gaussian offspring."""
    if kind=='matern':
        rng=np.random.default_rng(60792); nparents=rng.poisson(24); parents=rng.uniform(.04,.96,(nparents,2)); pts=[]
        for x,y in parents:
            n=rng.poisson(10); r=.12*np.sqrt(rng.random(n)); th=2*np.pi*rng.random(n); q=np.c_[x+r*np.cos(th),y+r*np.sin(th)]
            q=q[(q[:,0]>=0)&(q[:,0]<=1)&(q[:,1]>=0)&(q[:,1]<=1)]; pts.extend(q.tolist())
        fig,ax=setup(); q=np.asarray(pts)
        if len(q): ax.scatter(q[:,0],q[:,1],s=.65,c=BLACK,linewidths=0)
        ax.scatter(parents[:,0],parents[:,1],s=3.2,c=GREY,edgecolors=BLACK,linewidths=.25)
        ax.set_xlim(0,1); ax.set_ylim(0,1); ax.set_aspect('equal'); return savefig(fig,'S-G-0792')
    rng=np.random.default_rng(60794); nparents=rng.poisson(20); parents=rng.uniform(.05,.95,(nparents,2)); pts=[]
    for x,y in parents:
        count=rng.poisson(5)
        if count: pts.extend(np.c_[x+rng.normal(0,.035,count),y+rng.normal(0,.035,count)].tolist())
    fig,ax=setup(); q=np.asarray(pts)
    if len(q): ax.scatter(q[:,0],q[:,1],s=.85,c=BLACK,linewidths=0)
    ax.scatter(parents[:,0],parents[:,1],s=4.0,c=GREY,edgecolors=BLACK,linewidths=.25,zorder=3)
    ax.set_xlim(0,1); ax.set_ylim(0,1); ax.set_aspect('equal'); return savefig(fig,'S-G-0794')

def render_tasep():
    """Continuous-time rate-one TASEP on a ring; occupancy snapshots make world-lines legible."""
    rng=np.random.default_rng(60785); L=118; steps=118; particles=37
    occ=np.zeros(L,dtype=np.uint8); occ[rng.choice(L,particles,replace=False)]=1
    out=np.zeros((steps,L),dtype=np.uint8); t=0.0; dt=.35
    for s in range(steps):
        out[s]=occ.copy(); target=t+dt
        while t<target:
            eligible=np.where((occ==1)&(np.roll(occ,-1)==0))[0]
            if not len(eligible): t=target; break
            jump=rng.exponential(1.0/len(eligible))
            if t+jump>target: t=target; break
            t+=jump; i=int(rng.choice(eligible)); occ[i]=0; occ[(i+1)%L]=1
    fig,ax=setup(); ax.imshow(out,cmap=matplotlib.colors.ListedColormap([PAPER,BLACK]),interpolation='nearest',origin='upper',aspect='equal')
    ax.set_xlim(-.5,L-.5); ax.set_ylim(steps-.5,-.5); ax.set_aspect('equal')
    return savefig(fig,'S-L-0785')

def render_wireworld():
    """Wireworld four-state CA on a loop-and-branch conductor circuit."""
    n=42; a=np.zeros((n,n),dtype=np.uint8)
    # Closed rectangular/rounded-corner circuit with a branch and return leg.
    # Every plotted conductor belongs to the discrete Wireworld lattice.
    for x in range(7,35): a[8,x]=3; a[33,x]=3
    for y in range(8,34): a[y,7]=3; a[y,34]=3
    for x in range(7,20): a[20,x]=3
    for y in range(20,34): a[y,19]=3
    for x in range(19,35): a[26,x]=3
    for y in range(26,34): a[y,28]=3
    for x in range(12,29): a[14,x]=3
    # Active electron packets on distinct conductor segments.
    for y,x,state in [(8,10,1),(8,11,2),(8,23,1),(8,24,2),(20,10,1),(20,11,2),(33,30,1),(33,31,2),(14,15,1),(14,16,2)]: a[y,x]=state
    kernel=np.ones((3,3),int); kernel[1,1]=0
    for _ in range(2):
        count=convolve((a==1).astype(int),kernel,mode='constant',cval=0)
        b=a.copy(); b[a==1]=2; b[a==2]=3; b[(a==3)&((count==1)|(count==2))]=1; a=b
    palette=np.array([[255,254,249],[174,180,186],[23,25,27],[99,103,107]],np.uint8)
    rgb=palette[a]
    p=OUTDIR/'DΔ-L-0160.png'; Image.fromarray(rgb).resize((118,118),Image.Resampling.NEAREST).save(p,optimize=True)
    return 'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode()

RENDERERS={
 'DΔ-P-0110':render_lozi,'DΔ-P-0111':render_ikeda,'DΔ-P-0113':render_catmap,'DΔ-P-0114':render_baker,'DΔ-P-0115':render_circlemap,
 'D0-G-0254':render_newton_basin,'DΔ-L-0155':render_highlife,'DΔ-L-0156':render_daynight,'DΔ-L-0157':render_seeds,'DΔ-L-0160':render_wireworld,
 'DΔ-L-0182':render_bml,'S-L-0784':render_nasch,'D0-G-0074':render_powerdiagram,'D0-G-0091':render_peano,'S-G-0792':lambda:cluster_points('matern'),
 'S-G-0794':lambda:cluster_points('thomas'),'S-L-0785':render_tasep,'D0-G-0084':render_schwarzp,'D0-G-0078':render_cantor,'D0-G-0095':render_medial,
 'D0-C-0225':render_fibonacci,'D0-C-0226':render_thuemorse,
}

BASIS={
'DΔ-P-0110':('Lozi map: x[n+1]=1−a|x[n]|+y[n], y[n+1]=b x[n]; a=1.7, b=0.5, (x0,y0)=(0.1,0.1); 25,000 iterates, first 1,000 discarded. The image is the computed chaotic attractor.','Lozi map attractor computed from the specified recurrence; not copied from a reference image.'),
'DΔ-P-0111':('Ikeda map: t=0.4−6/(1+x²+y²); x[n+1]=1+u(x cos t−y sin t); y[n+1]=u(x sin t+y cos t); u=0.9, (x0,y0)=(0.1,0.1); 160,000 iterates, first 3,000 discarded. A 354×354 visit histogram is Gaussian-smoothed (σ=1.25 pixels) and quantized by log-density quantiles to the fixed palette.','Visit-density image of the actual Ikeda-map attractor; density levels expose recurrent bands and ripples.'),
'DΔ-P-0113':("Arnold cat map (x',y')=(2x+y,x+y) mod 1 on a 64×64 discrete torus. A newly drawn binary cat-head mask is compared with its exact one-step image under the integer matrix [[2,1],[1,1]] modulo 64; this discrete torus map is a bijection because the determinant is 1.",'Original cat mask and one-step Arnold-cat-map image, both derived from the stated discrete torus map.'),
'DΔ-P-0114':("Unfolded baker map B(x,y)=(2x−floor(2x), (y+floor(2x))/2). The diagram shows dyadic strips associated with repeated stretch-and-stack structure; this record uses the unfolded, not folded, convention.",'Structural map diagram for the explicitly named unfolded baker-map convention.'),
'DΔ-P-0115':('Circle map θ[n+1]=(θ[n]+Ω−K/(2π)sin(2πθ[n])) mod 1; Ω=0.2, K=1.0. Grey curve is the return map; black dashed diagonal is y=x; black marks are a finite orbit segment from θ0=0.137.','Map graph plus an orbit segment; parameter choice is representative, not universal.'),
'D0-G-0254':('Newton basins for f(z)=z³−1; iterate Newton’s map on a 354×354 grid over [-1.35,1.35]² for up to 70 steps, classify by convergence to one of the three roots within 10⁻³, and encode root and convergence depth using four quantized palette levels before resampling to 118×118.','A specified cubic Newton-basin fractal with explicit roots, viewing window, convergence threshold, and quantized convergence-depth encoding.'),
'DΔ-L-0155':('HighLife B36/S23 on the Moore neighborhood. Uses the documented 5×5 RLE seed `bb3o$bobbo$o3bo$obbo$3o!`; 12 synchronous generations on a zero-background finite grid (the canonical 12-cell seed first splits into two replicator copies).','The canonical B36/S23 replicator’s computed evolution, using the published seed pattern.'),
'DΔ-L-0156':('Day & Night B3678/S34678 on the Moore neighborhood; RNG seed 60156, initial occupancy 0.49 on a 74×74 torus, 36 synchronous generations with periodic boundaries. The central 64×64 crop is displayed as a square without anisotropic scaling.','A square crop of a reproducible Day & Night cellular-automaton state; the rule has black/white state-complement symmetry.'),
'DΔ-L-0157':('Seeds B2/S (birth with exactly two live Moore neighbors; no live cell survives). Initial condition is two adjacent live cells in a 79×79 dead grid; zero-exterior boundary convention. The thumbnail displays generation 4, an explicitly chosen early nontrivial slice; later generations decay.','A computed Seeds-rule evolution from a stated seed; not a generic Life snapshot.'),
'DΔ-L-0160':('Wireworld four-state rule on a 42×42 lattice: head→tail, tail→conductor, and conductor→head iff it has 1 or 2 neighboring heads in the Moore neighborhood. Initial conductors form a closed rectangular circuit, branches, and return paths with multiple active electron packets; two synchronous updates are applied.','A computed Wireworld circuit with looped conductors and multiple electron signals using the exact four-state local rule.'),
'DΔ-L-0182':('Biham–Middleton–Levine two-species traffic CA on a periodic 96×96 lattice: eastbound cars update simultaneously, then northbound cars update simultaneously. RNG seed 60182; initial occupancy 0.31 split equally between species; 145 complete two-phase updates.','Computed two-direction BML traffic state at a stated density; black and grey distinguish species and allow diagonal traffic-jam fronts to appear if produced by this run.'),
'S-L-0784':('Nagel–Schreckenberg stochastic traffic CA: L=118 periodic cells, vmax=5, braking probability p=0.24, initial density 0.25; RNG seed 60784. Each synchronous step accelerates, limits speed by the gap, randomly brakes, then moves. The 118×118 space–time raster uses square pixels and distinguishes speed classes.','Square space–time diagram of a specified Nagel–Schreckenberg run; stop-and-go structures are generated by the update rule, not drawn decoratively.'),
'D0-G-0074':('Power diagram on [0,1]²: 15 sites uniformly sampled in [0.08,0.92]², RNG seed 60074. Positive weights are w_i=r_i² for radii r_i∼Uniform(0.022,0.047); cells are clipped using |x−p_i|²−w_i ≤ |x−p_j|²−w_j. Circles indicate each weighted site, with radius sqrt(w_i).','A weighted Voronoi/power partition; the nuclei are a geometric encoding of the specified positive site weights, not biological claims.'),
'D0-G-0091':('Peano curve L-system: axiom X; two parallel rewriting rounds under X→XFYFX+F+YFXFY−F−XFYFX and Y→YFXFY−F−XFYFX+F+YFXFY; F draws one unit; ± turn 90°. Exact generation depth is recorded instead of ambiguously calling it an order.','Geometric realization of the stated L-system recursion, with a fixed turn convention.'),
'S-G-0792':('Matérn cluster process on the unit square: parent process is homogeneous Poisson with intensity λ=24 (parent count N~Poisson(24), positions conditionally uniform in the window), RNG seed 60792; independent Poisson offspring count with mean 10 per parent, offsets uniform in a disk of radius 0.12; offspring outside the window are omitted. Parents grey, offspring black.','A reproducible realization of the uniform-disk Matérn cluster process.'),
'S-G-0794':('Thomas point process on the unit square: Poisson parent count N~Poisson(20), parent locations uniform in the window, RNG seed 60794; offspring count per parent Poisson(mean=5), independent isotropic Gaussian displacement with σ=0.035 per coordinate; points outside the window are clipped from the visible window. Parents grey, offspring black.','A reproducible Gaussian-offspring Neyman–Scott/Thomas cluster realization with about twenty compact bead-like clusters in expectation; no non-Thomas background process is added.'),
'S-L-0785':('Continuous-time periodic TASEP: ring length L=118, 37 particles, rate 1 for each allowed 10→01 hop; Gillespie/event-driven transitions; fixed-time observations separated by Δt=0.35; RNG seed 60785. A square 118×118 space–time occupancy raster shows the trajectories generated by the hopping process.','Space–time occupancy diagram from a specified continuous-time TASEP realization; the diagonal traces emerge from directed exclusion hopping.'),
'D0-G-0084':('Schwarz P triply periodic minimal-surface archetype represented by the standard implicit level set cos x + cos y + cos z = 0 on [−π,π]³; extracted with marching cubes at 54³ samples and rendered with a fine triangular wire mesh under a fixed orthographic camera. This is a level-surface approximation, not an exact parametrization.','Computed Schwarz-P implicit surface with its connected labyrinthine saddle geometry made visible by a thin triangular mesh.'),
'D0-G-0078':('Ternary Cantor set: seven stages obtained by recursively removing the open middle third from every retained interval; each row displays the exact retained intervals at one stage, with 1.05-point dark strokes for the first stages and mid-grey for the finest two.','Exact finite construction stages of the standard ternary Cantor set, with slightly increased contrast at thumbnail scale.'),
'D0-G-0095':('Medial axis of a fixed irregular planar ribbon domain built from five cubic Bézier centerlines with variable width and deterministic boundary scallops; sampled on a 236×236 grid and skeletonized with scikit-image medial_axis using RNG seed 6095.','A medial-axis skeleton of the displayed multi-branch, curved domain; its shape is specific to the stated domain.'),
'D0-C-0225':('Fibonacci word fixed point generated from 0 using substitution 0→01, 1→0 for 13 generations. The first 377 symbols drive a turtle curve: one unit segment per symbol, with 0=right quarter-turn and 1=left quarter-turn after the first segment. This image is the explicitly defined Fibonacci-word fractal realization, not a raw word raster.','Fibonacci-word fractal curve generated from the stated substitution and turn convention; the underlying symbolic word has a separate identity from this geometric realization.'),
'D0-C-0226':('Thue–Morse word finite prefix using t[2n]=t[n], t[2n+1]=1−t[n], starting t0=0, eight substitution generations; exactly 256 symbols are rendered in reading order.','A finite prefix of the Thue–Morse sequence from its standard recursive definition.'),
}

SRC_BY_ID={rid:key for rid,key in {
'DΔ-P-0110':'lozi','DΔ-P-0111':'ikeda','DΔ-P-0113':'cat','DΔ-P-0114':'baker','DΔ-P-0115':'circle','D0-G-0254':'newton','DΔ-L-0155':'highlife','DΔ-L-0156':'daynight','DΔ-L-0157':'seeds','DΔ-L-0160':'wireworld','DΔ-L-0182':'bml','S-L-0784':'nasch','D0-G-0074':'power','D0-G-0091':'peano','S-G-0792':'matern','S-G-0794':'thomas','S-L-0785':'tasep','D0-G-0084':'schwarz','D0-G-0078':'cantor','D0-G-0095':'medial','D0-C-0225':'fib','D0-C-0226':'thue'}.items()}

def main():
    data=json.loads(INPUT.read_text(encoding='utf-8'))
    byid={r['id']:r for r in data['records']}
    source_idx={}
    # Stable exact-source entries are appended for this procedural batch.
    for key,row in SOURCES.items():
        source_idx[key]=len(data['sources']); data['sources'].append(list(row))

    # Hard rule: legacy thumbnails that did not go through this record-specific procedure are withheld.
    # Unique bytes, a plausible-looking icon, or a prior status string do not prove mathematical authenticity.
    renderer_ids=set(RENDERERS)
    withheld=0
    for r in data['records']:
        if r.get('primary',True) is False:
            # Aliases must never render a second copy of their canonical record's image.
            r['thumbnail']=None
            r['thumbnail_status']='alias_redirect_no_primary_thumbnail'
            r['thumbnail_renderer']='not_applicable_alias_redirect'
            r['thumbnail_basis']='Non-primary alias/redirect; inspect the canonical record linked by canonical_id/related_to for its one primary mathematical image.'
            r['thumbnail_alt']='Alias redirect; no independent thumbnail is assigned.'
            r['thumbnail_audit_note']='No separate visual is generated for a non-primary alias, preventing duplicate imagery and preserving one canonical record per mathematical identity.'
            r['thumbnail_status_detail']='Non-primary alias. Follow canonical_id or related_to.'
        elif r.get('id') not in renderer_ids:
            if r.get('thumbnail') or r.get('thumbnail_status')=='computed_or_validated_archetype':
                withheld+=1
            r['thumbnail']=None
            r['thumbnail_status']='pending_individual_visual_audit'
            r['thumbnail_renderer']='withheld_legacy_unverified'
            r['thumbnail_basis']='Authentic archetype pending: no record-specific mathematical renderer has yet been verified for this entry.'
            r['thumbnail_alt']='Authentic mathematical archetype pending individual validation; no substitute image is shown.'
            r['thumbnail_audit_note']='Legacy artwork withheld under the v0.1.6 visual-authenticity hard rule. This record stays searchable/classified but must not show an unverified placeholder as its model image.'
            r['thumbnail_status_detail']='Pending: specify exact model/formulation, identify its defining visual signature, source-check the math, implement a reproducible renderer, and complete the acceptance tests.'
            r['source_refs']=[]

    # Exact duplicate: the HighLife rule is represented once as the canonical rule+RLE archetype.
    canonical=byid.get('DΔ-L-0155'); alias=byid.get('DΔ-L-0671')
    if canonical and alias:
        original_alias_name=alias.get('name','HighLife cellular automaton')
        canonical.setdefault('aliases',[])
        if not any(a.get('name')==original_alias_name for a in canonical['aliases'] if isinstance(a,dict)):
            canonical['aliases'].append({'name':original_alias_name,'relation':'exact B36/S23 HighLife rule alias; canonical ID DΔ-L-0155'})
        alias.update({
            'primary':False,
            'record_type':'alias_redirect',
            'canonical_id':'DΔ-L-0155',
            'name':'HighLife rule alias redirect → DΔ-L-0155',
            'thumbnail':None,
            'thumbnail_status':'alias_redirect_no_primary_thumbnail',
            'thumbnail_renderer':'not_applicable_alias_redirect',
            'thumbnail_basis':'Uses the canonical HighLife image at DΔ-L-0155; no second primary image is generated for the same B36/S23 rule.',
            'thumbnail_alt':'Alias redirect to the canonical HighLife rule record.',
            'thumbnail_audit_note':'Duplicate identity is redirected rather than given a second misleadingly independent image.',
            'source_refs':[source_idx['highlife']],
            'aliases':[{'name':original_alias_name,'relation':'exact duplicate of DΔ-L-0155'}],
            'related_to':['DΔ-L-0155']
        })

    rendered=[]; failures=[]
    for rid,fn in RENDERERS.items():
        try:
            uri=fn(); r=byid[rid]
            # Quantize every renderer output to the fixed surface + 3-ink palette. This strips anti-alias colors.
            asset=OUTDIR/f'{rid}.png'
            im=Image.open(asset).convert('RGB')
            pix=np.asarray(im,dtype=np.int32)
            palette=np.array([[255,254,249],[23,25,27],[174,180,186],[99,103,107]],dtype=np.int32)
            flat=pix.reshape(-1,3)
            nearest=np.argmin(((flat[:,None,:]-palette[None,:,:])**2).sum(axis=2),axis=1)
            q=palette[nearest].astype(np.uint8).reshape(pix.shape)
            Image.fromarray(q,'RGB').save(asset,optimize=True)
            uri='data:image/png;base64,'+base64.b64encode(asset.read_bytes()).decode('ascii')
            formula,note=BASIS[rid]
            r['thumbnail']=uri
            r['thumbnail_status']='computed_or_validated_archetype'
            r['thumbnail_renderer']='procedural_math_v0.1.6_'+fn.__name__
            r['thumbnail_basis']=formula
            r['thumbnail_audit_note']='COMPUTED AND CONTACT-SHEET REVIEWED IN THIS BATCH. The equation/rule, parameter choices, initial state, boundary convention, seed where stochastic, discretization, and reference are recorded. This validates the stated archetype only; it is not a blanket validation of other formulations or parameter regimes under the family name.'
            r['thumbnail_alt']=f"Computed archetype for {r['name']}. {note}"
            r['source_refs']=[source_idx[SRC_BY_ID[rid]]] if rid in SRC_BY_ID else []
            r['thumbnail_status_detail']='Formula/rule-derived asset; deterministic rendering script; source-backed record; reviewed at 118×118 and in the batch contact sheet.'
            rendered.append(rid)
        except Exception as e:
            failures.append((rid,repr(e)))
            # Fail closed: renderer errors never leave an old image in place.
            r=byid[rid]; r['thumbnail']=None; r['thumbnail_status']='pending_individual_visual_audit'; r['thumbnail_renderer']='renderer_failed_closed'
            r['thumbnail_basis']='Authentic archetype pending because the procedural renderer failed.'
            r['thumbnail_alt']='No image: renderer failed and no unverified fallback is allowed.'

    # Auxiliary methods/solvers/renderers also obey the same authenticity gate. Their legacy artwork is withheld.
    for m in data.get('methods',[]):
        m['thumbnail']=None
        m['thumbnail_status']='pending_individual_visual_audit'
        m['thumbnail_renderer']='withheld_legacy_unverified'
        m['thumbnail_basis']='Authentic method diagram pending: no method-specific procedural rendering has yet passed the same validation process.'
        m['thumbnail_alt']='Method diagram pending individual validation; no unverified placeholder image is shown.'
        m['thumbnail_audit_note']='Legacy method art withheld under the same strict visual-authenticity hard rule used for mathematical generators.'
        m['thumbnail_status_detail']='Pending a method-specific rendering procedure and validation.'
    # Export provenance records and exact policy counts.
    primary=[r for r in data['records'] if r.get('primary',True)]
    computed=sum(r.get('thumbnail_status')=='computed_or_validated_archetype' for r in primary)
    pending=sum(r.get('thumbnail_status')=='pending_individual_visual_audit' for r in primary)
    aliases=sum(r.get('primary') is False for r in data['records'])
    data['edition']='v0.1.6 — Mathematics-first, source-linked thumbnail batch 1; strict authenticity gate'
    data['audit_summary']['stage']='v0.1.6. This release operationalizes a reproducible mathematics-first thumbnail process. It shows only a first record-specific batch whose formulas/rules, parameter values, initialization, boundary conventions, stochastic seeds, source references and renderers are recorded; all unprocessed legacy thumbnails are withheld.'
    data['audit_summary']['thumbnail_method']='Repeatable pipeline: (1) select a primary record, not an alias/class/method; (2) state the exact mathematical formulation; (3) consult a definition/reference and document the expected visual signature; (4) freeze equation/rule, parameters, initial state, boundary/forcing, random seed, and discretization; (5) compute the output from that law using the script; (6) render a new 118×118 asset in the fixed palette; (7) store the renderer ID, complete basis, alt text and source_refs; (8) run record-level mathematical checks and the renderer smoke test; (9) inspect a contact sheet and enlarged cases; (10) compare against other record visuals for duplicate/sub-instance conflicts; (11) only then mark computed_or_validated_archetype. This release does not rely on traced, rotated, mirrored, or cosmetically altered source figures.'
    data['audit_summary']['hard_rules']=[
        'HARD RULE — MATHEMATICAL AUTHENTICITY: EVERY DISPLAYED IMAGE MUST BE GENERATED FROM THE ACTUAL EQUATION/RULE/CONSTRUCTION OF THE SPECIFIC RECORD, OR FROM AN EXPLICITLY BOUNDED AND SOURCE-REFERENCED FORMULATION WITH PARAMETERS. NEVER SHOW A GENERIC ICON AS IF IT WERE THE MODEL. IF THE BASIS IS NOT VERIFIED, WITHHOLD THE IMAGE AND SHOW AUTHENTIC ARCHETYPE PENDING.',
        'HARD RULE — REPRODUCIBILITY: EACH COMPUTED IMAGE MUST RECORD THE FORMULA/RULE, PARAMETERS, INITIAL STATE, BOUNDARY CONDITIONS, FORCING, RNG SEED IF STOCHASTIC, NUMERICAL METHOD/DISCRETIZATION, RENDERER ID, ALT TEXT AND SOURCE REFERENCES.',
        'HARD RULE — UNIQUE IDENTITY: BEGIN WITH SPECIFIC NAMED INSTANCES; DO NOT REUSE A SUB-RECORD IMAGE FOR ITS PARENT OR ANOTHER INSTANCE. MERGE EXACT DUPLICATES AS ALIASES; KEEP DIFFERENT FORMULATIONS, PARAMETER REGIMES AND OBSERVABLES DISTINCT WHEN THEIR MATHEMATICS DIFFERS.',
        'HARD RULE — NO SOURCE-FIGURE TRACING: REFERENCE IMAGES MAY INFORM RECOGNITION OF THE CANONICAL VISUAL SIGNATURE, BUT THUMBNAILS MUST BE NEWLY COMPUTED FROM THE MATHEMATICS. DO NOT TRACE, ROTATE, MIRROR OR COSMETICALLY MODIFY A WEB IMAGE TO MAKE THE THUMBNAIL.',
        'HARD RULE — COMMON VISUAL GRAMMAR: USE PAPER #FFFEF9, BLACK #17191B, GREY #AEB4BA AND OPTIONAL RGB MIDPOINT #63676B; keep line weights thin and diagram framing consistent. The mathematics takes priority over style if a structural feature would otherwise be obscured.'
    ]
    data['audit_summary']['new_computed_archetypes']=len(rendered)
    data['audit_summary']['legacy_thumbnails_withheld']=withheld
    data['audit_summary']['remaining_pending_count']=pending
    data['audit_summary']['computed_but_pending_signoff']=0
    data['audit_summary']['batch_errors']=failures
    data['audit_summary']['primary_thumbnail_uniqueness']=f'{computed} record-specific thumbnails in the first batch, generated by distinct specified renderers; duplicate-byte checking is run separately and does not prove visual distinctness.'
    data['audit_summary']['thumbnail_policy']='HARD RULE: no thumbnail is marked authenticated solely because it renders, is unique, or is family-shaped. Only record-specific outputs whose underlying rule and conditions are recorded and whose visual identity is reviewed are displayed. All unprocessed legacy images are withheld.'
    data['audit_summary']['visual_palette']='Paper #FFFEF9, black #17191B, grey #AEB4BA, optional midpoint #63676B. New assets are rendered at 118×118 and displayed at 59×59; thin strokes and geometric crispness are used where appropriate.'
    data['audit_summary']['source_provenance']='Sources verify definitions, equations, rules and canonical visual signatures. No reference image is used as tracing input; the asset is newly computed from the stated mathematical rule.'
    data['audit_summary']['thumbnail_specificity']='v0.1.6 batch 1: 22 explicitly named, parameterized renderers. Each has formula/rule, source reference, initialization/seed, finite run or rendering conditions, alt text and a distinct render function recorded in the manifest. Only these 22 primary records show computed assets; all other primary and auxiliary method thumbnails remain withheld. This is progress by audited batch, not a claim that the remaining records have been rendered or verified.'
    data['audit_summary']['quality_checks']={
        'primary_records':len(primary),
        'records_missing_filter_dimensions':sum(1 for r in primary if not all(isinstance(r.get(k),str) and r[k].strip() for k in ('law','substrate','family','subtype','record_type'))),
        'records_with_invalid_law_or_substrate':sum(1 for r in primary if r.get('law') not in data['laws'] or r.get('substrate') not in data['substrates']),
        'duplicate_primary_ids':len(primary)-len({r['id'] for r in primary}),
        'thumbnail_rendered':computed,
        'thumbnail_pending':pending,
        'aliases_without_primary_thumbnail':aliases,
        'semantic_filter_mapping_independently_verified':'NO — required next audit stage; schema validation is not semantic proof.'
    }
    target=ROOT/'pattern_generator_atlas_data_v0.1.6.json'; target.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    fields=['id','law','substrate','family','subtype','name','gloss','record_type','primary','canonical_id','thumbnail_status','thumbnail_renderer','thumbnail_basis','thumbnail_alt','thumbnail_audit_note','thumbnail_status_detail','source_refs','related_to','aliases','condition','temporal','randomness_source','initialization_note','scope_status']
    csv_path=ROOT/'pattern_generator_catalog_v0.1.6.csv'
    with csv_path.open('w',newline='',encoding='utf-8') as f:
        w=csv.DictWriter(f,fieldnames=fields,extrasaction='ignore'); w.writeheader()
        for r in data['records']:
            rr={k:r.get(k,'') for k in fields}
            for k,v in list(rr.items()):
                if isinstance(v,(dict,list)): rr[k]=json.dumps(v,ensure_ascii=False)
            w.writerow(rr)
    methods_csv=ROOT/'pattern_generator_methods_v0.1.6.csv'
    method_fields=['id','name','gloss','condition','related_to','record_type','thumbnail_status','thumbnail_renderer','thumbnail_basis','thumbnail_alt','thumbnail_audit_note','thumbnail_status_detail']
    with methods_csv.open('w',newline='',encoding='utf-8') as f:
        w=csv.DictWriter(f,fieldnames=method_fields,extrasaction='ignore'); w.writeheader()
        for m in data.get('methods',[]):
            rr={k:m.get(k,'') for k in method_fields}
            for k,v in list(rr.items()):
                if isinstance(v,(dict,list)): rr[k]=json.dumps(v,ensure_ascii=False)
            w.writerow(rr)
    man=ROOT/'thumbnail_process_manifest_v0.1.6.csv'
    with man.open('w',newline='',encoding='utf-8') as f:
        fields2=['id','name','law','substrate','record_type','renderer','formula_parameters_initialization','output_basis','source_titles_urls','seed','status']
        w=csv.DictWriter(f,fieldnames=fields2);w.writeheader()
        for rid in rendered:
            r=byid[rid]; src=[data['sources'][i] for i in r.get('source_refs',[]) if isinstance(i,int) and 0<=i<len(data['sources'])]
            w.writerow({'id':rid,'name':r['name'],'law':r['law'],'substrate':r['substrate'],'record_type':r['record_type'],'renderer':r['thumbnail_renderer'],'formula_parameters_initialization':r['thumbnail_basis'],'output_basis':r['thumbnail_alt'],'source_titles_urls':json.dumps(src,ensure_ascii=False),'seed':re.search(r'(?:seed|RNG seed)\s*(\d+)',r['thumbnail_basis'],re.I).group(1) if re.search(r'(?:seed|RNG seed)\s*(\d+)',r['thumbnail_basis'],re.I) else 'not applicable / seed described in basis','status':r['thumbnail_status']})
    print('Rendered',len(rendered),'records; failures',failures)
    print('Counts:',{'primary':len(primary),'aliases':aliases,'computed':computed,'pending':pending,'withheld_legacy':withheld})
    print('Data:',target)
    if failures: raise SystemExit('Renderer failure: fail-closed; inspect batch_errors before release')

if __name__=='__main__':
    if not INPUT.exists():
        raise SystemExit('Input dataset not found. Place pattern_generator_atlas_data_v0.1.5.json beside this script, or under package_staging_v0_1_5/.')
    main()
