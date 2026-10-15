"""Project the M on the user-reviewed rounded L wall into the vector logo."""
import math
from waterline_profile import waterline_y

ORIGINAL_M = 'M118,104 H150 L214,160 L275,104 H304 V255 H266 V164 L214,211 L156,164 V255 H118 Z'
VERTICES = [(118,104),(150,104),(214,160),(275,104),(304,104),
            (304,255),(266,255),(266,164),(214,211),(156,164),(156,255),(118,255)]
CORNER_RADIUS = .55
SHORT_RUN = 1.8
CORNER_LENGTH = CORNER_RADIUS*math.pi/2
M_START = SHORT_RUN-.60+.52
M_WIDTH = .60+CORNER_LENGTH+1.20
M_TOP, M_BOTTOM = 1.56, .12
YAW, ELEVATION, DISTANCE = -52, -7, 6.9
TARGET = [1.55,1.12,-.20]
LOGO_LEFT, LOGO_WIDTH, LOGO_BASE = 124, 194, 255
FOOT_GAP = 7
RIGHT_LEG_WIDTH_SCALE = 1.20


def sub(a,b):
    return [x-y for x,y in zip(a,b)]


def dot(a,b):
    return sum(x*y for x,y in zip(a,b))


def cross(a,b):
    return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]


def unit(a):
    length=math.sqrt(dot(a,a))
    return [x/length for x in a]


def wall_point(s,y):
    if s<=SHORT_RUN:
        x,z,nx,nz=-CORNER_RADIUS,s-SHORT_RUN,-1,0
    elif s<=SHORT_RUN+CORNER_LENGTH:
        t=(s-SHORT_RUN)/CORNER_RADIUS
        x,z=-CORNER_RADIUS*math.cos(t),CORNER_RADIUS*math.sin(t)
        nx,nz=-math.cos(t),math.sin(t)
    else:
        x,z,nx,nz=s-SHORT_RUN-CORNER_LENGTH,CORNER_RADIUS,0,1
    return [x+.007*nx,y,z+.007*nz]


def camera():
    a,e=math.radians(YAW),math.radians(ELEVATION)
    eye=[TARGET[i]+v for i,v in enumerate([math.sin(a)*math.cos(e)*DISTANCE,
                                         math.sin(e)*DISTANCE,math.cos(a)*math.cos(e)*DISTANCE])]
    z=unit(sub(eye,TARGET));x=unit(cross([0,1,0],z));y=cross(z,x)
    return eye,x,y,z


def raw_projection(x,y):
    u,v=(x-118)/186,(y-104)/151
    p=wall_point(M_START+u*M_WIDTH,M_TOP+(M_BOTTOM-M_TOP)*v)
    eye,right,up,z=camera();q=sub(p,eye);depth=-dot(q,z)
    return dot(q,right)/depth,-dot(q,up)/depth


def monogram_path(right_leg_width_scale=RIGHT_LEG_WIDTH_SCALE, diagnostics=None):
    # Keep this calibration on the approved vertices. Expanding the outline
    # must not refit or move any of the previously approved strokes.
    samples=[]
    for a,b in zip(VERTICES,VERTICES[1:]+VERTICES[:1]):
        for i in range(101):
            t=i/100
            samples.append(raw_projection(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t))
    min_x,max_x=min(p[0] for p in samples),max(p[0] for p in samples)
    max_y=max(p[1] for p in samples)
    scale=LOGO_WIDTH/(max_x-min_x)

    def unchanged_project(x,y):
        px,py=raw_projection(x,y)
        return LOGO_LEFT+(px-min_x)*scale,LOGO_BASE+(py-max_y)*scale

    def upright_x(source_x, screen_y):
        a=unchanged_project(source_x,164)
        b=unchanged_project(source_x,215)
        return a[0]+(b[0]-a[0])*(screen_y-a[1])/(b[1]-a[1])

    # These uprights lie on the same flat wall face and share a vanishing
    # point. A visible 1.20 width ratio therefore holds along their bodies.
    reference_y=210
    inner=upright_x(266,reference_y)
    target=inner+right_leg_width_scale*(upright_x(304,reference_y)-inner)
    if right_leg_width_scale==1:
        outer_x=304
    else:
        lo,hi=304,342
        for _ in range(60):
            mid=(lo+hi)/2
            if upright_x(mid,reference_y)<target:lo=mid
            else:hi=mid
        outer_x=(lo+hi)/2
    outline=[(outer_x,y) if x==304 else (x,y) for x,y in VERTICES]

    def project(x,y):
        px,py=unchanged_project(x,y)
        if y<=215:return px,py
        ax,ay=unchanged_project(x,215)
        fx,fy=unchanged_project(x,255)
        lean=(fx-ax)/(fy-ay)
        foot_x=fx
        for _ in range(8):
            foot_y=waterline_y(foot_x)-FOOT_GAP
            foot_x=ax+lean*(foot_y-ay)
        foot_y=waterline_y(foot_x)-FOOT_GAP
        fraction=(py-ay)/(fy-ay)
        return ax+(foot_x-ax)*fraction,ay+(foot_y-ay)*fraction

    def fmt(p):
        return f'{p[0]:.3f},{p[1]:.3f}'

    commands=['M'+fmt(project(*outline[0]))]
    edge_commands=[]
    for a,b in zip(outline,outline[1:]+outline[:1]):
        edge_start=len(commands)
        count=max(1,math.ceil(math.dist(a,b)/8))
        splits={i/count for i in range(count+1)}
        if b[0]!=a[0]:
            for s in [SHORT_RUN,SHORT_RUN+CORNER_LENGTH]:
                u=(s-M_START)/M_WIDTH
                x=118+186*u
                t=(x-a[0])/(b[0]-a[0])
                if 0<t<1:splits.add(t)
        if b[1]!=a[1]:
            t=(215-a[1])/(b[1]-a[1])
            if 0<t<1:splits.add(t)
        splits=sorted(splits)
        def point(t):
            return project(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t)
        def derivative(t):
            step=.000001;lo,hi=point(t-step),point(t+step)
            return ((hi[0]-lo[0])/(2*step),(hi[1]-lo[1])/(2*step))
        for t0,t1 in zip(splits,splits[1:]):
            p,q=point(t0),point(t1);dp,dq=derivative(t0),derivative(t1);h=(t1-t0)/3
            c1=(p[0]+dp[0]*h,p[1]+dp[1]*h);c2=(q[0]-dq[0]*h,q[1]-dq[1]*h)
            commands.append('C'+fmt(c1)+' '+fmt(c2)+' '+fmt(q))
        edge_commands.append(commands[edge_start:])
    if diagnostics is not None:
        diagnostics.update({'rightLegWidthScale':right_leg_width_scale,
                            'outerSourceX':outer_x,'edgeCommands':edge_commands,
                            'bodyWidths':[{'y':y,'innerX':upright_x(266,y),
                            'oldOuterX':upright_x(304,y),'newOuterX':upright_x(outer_x,y)}
                            for y in [190,210,230,245]]})
    return ' '.join(commands)+' Z'
