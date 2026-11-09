/**
 * Wortschatz scene renderer — original SVG from F scene contracts.
 * Neutral accessible labels only; no answer-bearing titles/alt/filenames.
 */
(function (global) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function vb(params, fallback) {
    const v = (params && params.viewBox) || fallback || [0, 0, 320, 240];
    return v.join(' ');
  }

  function wrap(viewBox, inner, label) {
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' +
      esc(viewBox) +
      '" role="img" aria-label="' +
      esc(label || 'Abbildung') +
      '" focusable="false">' +
      inner +
      '</svg>'
    );
  }

  function disc(cx, cy, r, fill, stroke) {
    return (
      '<circle cx="' +
      cx +
      '" cy="' +
      cy +
      '" r="' +
      r +
      '" fill="' +
      fill +
      '" stroke="' +
      (stroke || 'none') +
      '" stroke-width="2"/>'
    );
  }

  function apple(cx, cy, scale) {
    const s = scale || 1;
    return (
      '<g transform="translate(' +
      cx +
      ',' +
      cy +
      ') scale(' +
      s +
      ')">' +
      '<ellipse cx="0" cy="2" rx="14" ry="15" fill="#D62728"/>' +
      '<path d="M0,-10 C2,-18 8,-18 6,-10" fill="none" stroke="#3a7a2a" stroke-width="2"/>' +
      '<ellipse cx="8" cy="-8" rx="6" ry="3" fill="#3a7a2a" transform="rotate(25)"/>' +
      '</g>'
    );
  }

  function renderCountArray(contract, variant) {
    const p = Object.assign({}, contract.parameters, variant || {});
    const count = p.count;
    const cols = p.columns || 5;
    const cell = p.cell || [48, 42];
    const origin = p.origin || [40, 30];
    const radius = p.radius || 12;
    const object = p.object || 'solid_disc';
    let parts = [];
    parts.push('<rect x="12" y="12" width="296" height="206" rx="16" fill="#f7f3ea" stroke="#8a7a62" stroke-width="3"/>');
    if (count === 0 && p.zeroShowsEmptyTray) {
      parts.push('<text x="160" y="125" text-anchor="middle" font-size="14" fill="#8a7a62" font-family="Segoe UI,sans-serif"> </text>');
    } else {
      for (let i = 0; i < count; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = origin[0] + col * cell[0];
        const cy = origin[1] + row * cell[1];
        if (object === 'apple' || p.secondaryVariantObject === 'apple' && variant && variant.useApple) {
          parts.push(apple(cx, cy, 0.9));
        } else {
          parts.push(disc(cx, cy, radius, '#2f6fed', '#1a3f8a'));
        }
      }
    }
    return wrap(vb(p, [0, 0, 320, 230]), parts.join(''), contract.accessibleNeutralLabelDe);
  }

  function renderColorSwatch(contract) {
    const p = contract.parameters;
    const [cx, cy] = p.center;
    return wrap(
      vb(p, [0, 0, 240, 180]),
      '<rect width="240" height="180" fill="' +
        esc(p.background) +
        '"/>' +
        disc(cx, cy, p.radius, p.fill, p.border),
      contract.accessibleNeutralLabelDe
    );
  }

  function renderCircle(contract) {
    const p = contract.parameters;
    const g = p.geometry;
    return wrap(
      vb(p, [0, 0, 240, 180]),
      '<rect width="240" height="180" fill="#f4f7fb"/>' + disc(g.center[0], g.center[1], g.radius, p.fill, '#1f4660'),
      contract.accessibleNeutralLabelDe
    );
  }

  function renderPolygon(contract) {
    const p = contract.parameters;
    const pts = p.geometry.points.map((pt) => pt.join(',')).join(' ');
    return wrap(
      vb(p, [0, 0, 240, 180]),
      '<rect width="240" height="180" fill="#f4f7fb"/>' +
        '<polygon points="' +
        pts +
        '" fill="' +
        p.fill +
        '" stroke="#1f4660" stroke-width="2"/>',
      contract.accessibleNeutralLabelDe
    );
  }

  function renderRect(contract) {
    const p = contract.parameters;
    const g = p.geometry;
    return wrap(
      vb(p, [0, 0, 240, 180]),
      '<rect width="240" height="180" fill="#f4f7fb"/>' +
        '<rect x="' +
        g.x +
        '" y="' +
        g.y +
        '" width="' +
        g.width +
        '" height="' +
        g.height +
        '" fill="' +
        p.fill +
        '" stroke="#1f4660" stroke-width="2"/>',
      contract.accessibleNeutralLabelDe
    );
  }

  function renderCube(contract) {
    const p = contract.parameters;
    const front = p.geometry.frontSquare;
    const [dx, dy] = p.geometry.depthOffset;
    const back = front.map(([x, y]) => [x + dx, y + dy]);
    const face = (pts, fill) =>
      '<polygon points="' + pts.map((pt) => pt.join(',')).join(' ') + '" fill="' + fill + '" stroke="#1f4660" stroke-width="2"/>';
    const top = [front[0], front[1], back[1], back[0]];
    const side = [front[1], back[1], back[2], front[2]];
    return wrap(
      vb(p, [0, 0, 240, 180]),
      '<rect width="240" height="180" fill="#f4f7fb"/>' +
        face(top, '#5fa0c0') +
        face(side, '#2d6280') +
        face(front, p.fill),
      contract.accessibleNeutralLabelDe
    );
  }

  function renderSphere(contract) {
    const p = contract.parameters;
    const g = p.geometry;
    const id = 'grad-' + (contract.id || 'sphere').replace(/[^a-z0-9]/gi, '');
    return wrap(
      vb(p, [0, 0, 240, 180]),
      '<defs><radialGradient id="' +
        id +
        '" cx="35%" cy="30%"><stop offset="0%" stop-color="#9fd0e8"/><stop offset="55%" stop-color="' +
        p.fill +
        '"/><stop offset="100%" stop-color="#16384c"/></radialGradient></defs>' +
        '<rect width="240" height="180" fill="#f4f7fb"/>' +
        '<circle cx="' +
        g.center[0] +
        '" cy="' +
        g.center[1] +
        '" r="' +
        g.radius +
        '" fill="url(#' +
        id +
        ')" stroke="#1f4660" stroke-width="2"/>',
      contract.accessibleNeutralLabelDe
    );
  }

  function tableLegs(x1, x2, topY, floorY) {
    return (
      '<rect x="' +
      (x1 - 3) +
      '" y="' +
      (topY + 12) +
      '" width="6" height="' +
      (floorY - topY - 12) +
      '" fill="#8b5a2b"/>' +
      '<rect x="' +
      (x2 - 3) +
      '" y="' +
      (topY + 12) +
      '" width="6" height="' +
      (floorY - topY - 12) +
      '" fill="#8b5a2b"/>'
    );
  }

  function renderSpatial(contract) {
    const p = contract.parameters;
    const id = contract.id;
    let parts = ['<rect width="320" height="250" fill="#f7fafc"/>'];
    if (id === 'scene-spatial-auf') {
      const [tx, ty, tw, th] = p.tableTop;
      parts.push('<rect x="' + tx + '" y="' + ty + '" width="' + tw + '" height="' + th + '" fill="#a67c3a" rx="2"/>');
      parts.push(tableLegs(tx + 10, tx + tw - 10, ty, 200));
      parts.push(disc(p.ballCenter[0], p.ballCenter[1], p.ballRadius, '#e4572e', '#7a2410'));
    } else if (id === 'scene-spatial-unter') {
      const [tx, ty, tw, th] = p.tableTop;
      parts.push('<rect x="' + tx + '" y="' + ty + '" width="' + tw + '" height="' + th + '" fill="#a67c3a" rx="2"/>');
      parts.push(tableLegs(p.legsAtX[0], p.legsAtX[1], ty, p.floorY));
      parts.push('<line x1="40" y1="' + p.floorY + '" x2="280" y2="' + p.floorY + '" stroke="#888" stroke-width="2"/>');
      parts.push(disc(p.ballCenter[0], p.ballCenter[1], p.ballRadius, '#e4572e', '#7a2410'));
    } else if (id === 'scene-spatial-neben') {
      const [bx, by, bw, bh] = p.boxRect;
      parts.push('<rect x="' + bx + '" y="' + by + '" width="' + bw + '" height="' + bh + '" fill="#6c8ebf" stroke="#2a3f66" stroke-width="2"/>');
      parts.push('<line x1="40" y1="' + p.sameFloorY + '" x2="280" y2="' + p.sameFloorY + '" stroke="#888" stroke-width="2"/>');
      parts.push(disc(p.ballCenter[0], p.ballCenter[1], p.ballRadius, '#e4572e', '#7a2410'));
    } else if (id === 'scene-spatial-in') {
      const [bx, by, bw, bh] = p.boxRect;
      parts.push('<rect x="' + bx + '" y="' + by + '" width="' + bw + '" height="' + bh + '" fill="#d9e6f5" stroke="#2a3f66" stroke-width="3"/>');
      parts.push('<line x1="' + bx + '" y1="' + by + '" x2="' + (bx + 20) + '" y2="' + (by - 25) + '" stroke="#2a3f66" stroke-width="3"/>');
      parts.push('<line x1="' + (bx + bw) + '" y1="' + by + '" x2="' + (bx + bw + 20) + '" y2="' + (by - 25) + '" stroke="#2a3f66" stroke-width="3"/>');
      parts.push('<line x1="' + (bx + 20) + '" y1="' + (by - 25) + '" x2="' + (bx + bw + 20) + '" y2="' + (by - 25) + '" stroke="#2a3f66" stroke-width="3"/>');
      parts.push(disc(p.ballCenter[0], p.ballCenter[1], p.ballRadius, '#e4572e', '#7a2410'));
    } else if (id === 'scene-spatial-vor' || id === 'scene-spatial-hinter') {
      // 1.2.1: same tree size in both scenes; only depth differs. "hinter": the tree stands
      // farther back and is partly hidden by the house. "vor": the tree stands between the
      // viewer and the front door and covers part of the wall.
      const [hx, hy, hw, hh] = p.houseRect;
      const [tx, ty] = p.treeCenter;
      const tBase = p.treeBaseY != null ? p.treeBaseY : ty + 22;
      const tr = p.treeRadius || 26;
      const treeSvg =
        '<rect x="' + (tx - 5) + '" y="' + (ty + 10) + '" width="10" height="' + Math.max(10, tBase - ty - 10) + '" fill="#6b4226" stroke="#3e2614" stroke-width="1"/>' +
        '<circle cx="' + tx + '" cy="' + ty + '" r="' + tr + '" fill="#2f8f3a" stroke="#1d5c25" stroke-width="2"/>' +
        '<circle cx="' + (tx - tr / 3) + '" cy="' + (ty - tr / 4) + '" r="' + Math.round(tr / 3.5) + '" fill="#3fa84b"/>';
      const behind = p.treeDrawOrder ? p.treeDrawOrder === 'behind_house' : id === 'scene-spatial-hinter';
      parts.push('<rect x="0" y="' + (hy + hh - 6) + '" width="320" height="' + (250 - (hy + hh - 6)) + '" fill="#e3efd9"/>');
      if (behind) parts.push(treeSvg);
      parts.push('<rect x="' + hx + '" y="' + hy + '" width="' + hw + '" height="' + hh + '" fill="#d9c2a0" stroke="#5a4630" stroke-width="2"/>');
      parts.push('<polygon points="' + hx + ',' + hy + ' ' + (hx + hw / 2) + ',' + (hy - 30) + ' ' + (hx + hw) + ',' + hy + '" fill="#b33a3a" stroke="#5a2020" stroke-width="2"/>');
      const [dx, dy] = p.doorCenter;
      parts.push('<rect x="' + (dx - 12) + '" y="' + (dy - 28) + '" width="24" height="28" fill="#6b4226"/>');
      if (!behind) parts.push(treeSvg);
      const [vx, vy] = p.viewerAt;
      parts.push('<circle cx="' + vx + '" cy="' + (vy - 18) + '" r="8" fill="#f0c7a0"/><rect x="' + (vx - 10) + '" y="' + (vy - 10) + '" width="20" height="22" fill="#3d6ea8"/>');
    }
    return wrap(vb(p, [0, 0, 320, 250]), parts.join(''), contract.accessibleNeutralLabelDe);
  }

  function renderHalf(contract, variant) {
    const p = contract.parameters;
    const highlighted = (variant && variant.highlighted != null) ? variant.highlighted : p.highlighted;
    const total = p.total;
    const cols = p.columns || 4;
    let parts = ['<rect width="320" height="200" fill="#f7f3ea"/>'];
    for (let i = 0; i < total; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = 40 + col * 60;
      const y = 40 + row * 70;
      const on = i < highlighted;
      parts.push(
        '<rect x="' +
          x +
          '" y="' +
          y +
          '" width="44" height="44" rx="8" fill="' +
          (on ? '#f4a261' : '#ffffff') +
          '" stroke="' +
          (on ? '#9a3412' : '#666') +
          '" stroke-width="' +
          (on ? 4 : 2) +
          '" stroke-dasharray="' +
          (on ? '0' : '4 3') +
          '"/>'
      );
    }
    return wrap('0 0 320 200', parts.join(''), contract.accessibleNeutralLabelDe);
  }

  function renderTable(contract, variant) {
    const p = contract.parameters;
    const headers = p.headers;
    const data = p.data;
    const mode = (variant && variant.highlight) || 'none';
    let parts = ['<rect width="320" height="240" fill="#ffffff"/>'];
    const cellW = 90;
    const cellH = 36;
    const ox = 25;
    const oy = 30;
    const cols = p.columns;
    const rows = p.rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = ox + c * cellW;
        const y = oy + r * cellH;
        let fill = r === 0 ? '#dbe7f5' : '#fff';
        let stroke = '#334';
        let sw = 1.5;
        if (mode === 'row' && r === p.rowHighlight) {
          fill = '#ffe8a3';
          sw = 3;
        }
        if (mode === 'column' && c === p.columnHighlight) {
          fill = '#c7f0d0';
          sw = 3;
        }
        parts.push('<rect x="' + x + '" y="' + y + '" width="' + cellW + '" height="' + cellH + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>');
        let text = '';
        if (r === 0) text = headers[c];
        else text = String(data[r - 1][c]);
        parts.push(
          '<text x="' +
            (x + cellW / 2) +
            '" y="' +
            (y + 24) +
            '" text-anchor="middle" font-size="14" font-family="Segoe UI,sans-serif" fill="#222">' +
            esc(text) +
            '</text>'
        );
      }
    }
    return wrap('0 0 320 240', parts.join(''), contract.accessibleNeutralLabelDe);
  }

  function renderObject(contract) {
    const id = contract.id;
    const p = contract.parameters;
    let parts = ['<rect width="320" height="240" fill="#f8fafc"/>'];
    if (id === 'scene-object-apfel') {
      parts.push(apple(110, 120, 3.2));
      // cut apple with core
      parts.push(
        '<g transform="translate(230,120)">' +
          '<path d="M0,-30 C12,-44 44,-40 44,-6 C44,26 22,44 0,38 C-22,44 -44,26 -44,-6 C-44,-40 -12,-44 0,-30 Z" fill="#fbf1d6" stroke="#c0392b" stroke-width="5"/>' +
          '<path d="M0,-34 L2,-48" stroke="#5a3a1a" stroke-width="4" stroke-linecap="round"/>' +
          '<path d="M0,-14 C10,-10 12,8 0,16 C-12,8 -10,-10 0,-14 Z" fill="none" stroke="#c9a15a" stroke-width="2"/>' +
          '<ellipse cx="-4" cy="0" rx="2.5" ry="5" fill="#3a2410"/><ellipse cx="4" cy="0" rx="2.5" ry="5" fill="#3a2410"/>' +
          '</g>'
      );
    } else if (id === 'scene-object-heft') {
      parts.push('<rect x="70" y="40" width="180" height="160" rx="4" fill="#f4f7ff" stroke="#2a4a7a" stroke-width="3"/>');
      for (let i = 0; i < 8; i++) {
        parts.push('<line x1="90" y1="' + (70 + i * 16) + '" x2="230" y2="' + (70 + i * 16) + '" stroke="#9bb0d0" stroke-width="2"/>');
      }
      parts.push('<rect x="70" y="40" width="14" height="160" fill="#3d6ea8"/>');
    } else if (id === 'scene-object-buch') {
      parts.push('<rect x="60" y="50" width="90" height="140" fill="#7a3b2e" stroke="#3a1a12" stroke-width="2"/>');
      parts.push('<rect x="150" y="50" width="100" height="140" fill="#f7f1e3" stroke="#3a1a12" stroke-width="2"/>');
      for (let i = 0; i < 7; i++) {
        parts.push('<line x1="165" y1="' + (75 + i * 16) + '" x2="235" y2="' + (75 + i * 16) + '" stroke="#666" stroke-width="2"/>');
      }
      parts.push('<rect x="55" y="48" width="10" height="144" fill="#5a2a1e"/>');
    } else if (id === 'scene-object-reis') {
      parts.push('<ellipse cx="160" cy="170" rx="90" ry="22" fill="#c9b79a"/><ellipse cx="160" cy="150" rx="80" ry="40" fill="#efe6d4" stroke="#8a7a62" stroke-width="3"/>');
      for (let i = 0; i < 40; i++) {
        const x = 100 + (i % 10) * 12 + (i % 3);
        const y = 130 + Math.floor(i / 10) * 10 + (i % 2) * 3;
        parts.push('<ellipse cx="' + x + '" cy="' + y + '" rx="5" ry="2.5" fill="#f7f2e0" stroke="#b8a88a" stroke-width="0.8" transform="rotate(' + ((i * 17) % 40 - 20) + ' ' + x + ' ' + y + ')"/>');
      }
    } else if (id === 'scene-object-ziege') {
      // 1.2.1 (I-10): goat with backward-curved horns, chin beard, cloven dark hooves,
      // side ear, short upright tail.
      const leg = (x) =>
        '<rect x="' + x + '" y="158" width="10" height="42" rx="3" fill="#e9e2d0" stroke="#6b5e48" stroke-width="2"/>' +
        '<path d="M' + (x - 1) + ',198 h12 v8 h-5 v-4 h-2 v4 h-5 Z" fill="#2b2b2b"/>';
      parts.push(
        '<rect x="0" y="206" width="320" height="34" fill="#e3efd9"/>' +
          leg(98) + leg(116) + leg(178) + leg(196) +
          '<path d="M92,128 L82,104 L96,118" fill="#e9e2d0" stroke="#6b5e48" stroke-width="2" stroke-linejoin="round"/>' +
          '<ellipse cx="150" cy="140" rx="64" ry="30" fill="#f2ecdc" stroke="#6b5e48" stroke-width="2.5"/>' +
          '<path d="M196,128 C206,112 214,98 222,90 L240,104 C230,116 220,132 212,146 Z" fill="#f2ecdc" stroke="#6b5e48" stroke-width="2.5" stroke-linejoin="round"/>' +
          '<path d="M222,74 C238,70 254,78 266,96 C270,104 266,112 258,112 C248,112 236,106 226,100 C216,94 214,80 222,74 Z" fill="#f2ecdc" stroke="#6b5e48" stroke-width="2.5"/>' +
          '<path d="M226,74 C222,56 208,44 194,46 C206,50 214,60 216,76 Z" fill="#9c8462" stroke="#5a4630" stroke-width="2"/>' +
          '<path d="M234,72 C232,54 220,40 206,40 C218,46 226,58 226,74 Z" fill="#b39a74" stroke="#5a4630" stroke-width="2"/>' +
          '<path d="M222,86 C210,90 200,98 196,104 C206,102 216,98 226,94 Z" fill="#e0d6bf" stroke="#6b5e48" stroke-width="2"/>' +
          '<path d="M252,110 C254,122 250,134 244,140 C242,130 242,120 244,110 Z" fill="#cdbf9f" stroke="#6b5e48" stroke-width="2"/>' +
          '<circle cx="244" cy="86" r="3.2" fill="#222"/>' +
          '<ellipse cx="262" cy="100" rx="2" ry="1.5" fill="#5a4630"/>' +
          '<path d="M250,106 Q256,110 262,106" fill="none" stroke="#5a4630" stroke-width="1.5"/>'
      );
    } else if (id === 'scene-object-ohr') {
      parts.push(
        '<ellipse cx="140" cy="120" rx="55" ry="70" fill="#f0c7a0" stroke="#b8845a" stroke-width="2"/>' +
          '<path d="M185,90 C230,70 245,120 220,150 C200,170 185,150 185,130 C185,110 200,100 185,90 Z" fill="#e8b48a" stroke="#b8845a" stroke-width="3"/>' +
          '<path d="M200,105 C220,100 225,125 210,135" fill="none" stroke="#a06a45" stroke-width="3"/>' +
          '<circle cx="125" cy="110" r="4" fill="#333"/><path d="M95,140 Q115,155 130,145" fill="none" stroke="#a06a45" stroke-width="2"/>'
      );
    } else if (id === 'scene-object-hand') {
      parts.push(
        '<rect x="130" y="150" width="60" height="70" rx="20" fill="#f0c7a0"/>' +
          '<rect x="118" y="70" width="18" height="90" rx="9" fill="#f0c7a0"/>' +
          '<rect x="140" y="55" width="18" height="100" rx="9" fill="#f0c7a0"/>' +
          '<rect x="162" y="60" width="18" height="95" rx="9" fill="#f0c7a0"/>' +
          '<rect x="184" y="75" width="18" height="85" rx="9" fill="#f0c7a0"/>' +
          '<rect x="95" y="120" width="40" height="18" rx="9" fill="#f0c7a0" transform="rotate(-25 115 129)"/>'
      );
    } else if (id === 'scene-object-regenschirm') {
      parts.push(
        '<circle cx="150" cy="172" r="14" fill="#f0c7a0"/><rect x="138" y="188" width="24" height="34" rx="4" fill="#3d6ea8"/>' +
          '<line x1="182" y1="96" x2="182" y2="206" stroke="#444" stroke-width="4"/>' +
          '<path d="M182,206 q0,10 -8,10 q-7,0 -7,-7" fill="none" stroke="#444" stroke-width="4"/>' +
          '<line x1="160" y1="198" x2="182" y2="198" stroke="#3d6ea8" stroke-width="6" stroke-linecap="round"/>' +
          '<path d="M90,120 Q182,30 274,120 Z" fill="#2a6fdb" stroke="#1a3f8a" stroke-width="2"/>' +
          '<line x1="90" y1="50" x2="85" y2="70" stroke="#4aa3ff" stroke-width="3"/>' +
          '<line x1="120" y1="40" x2="115" y2="60" stroke="#4aa3ff" stroke-width="3"/>' +
          '<line x1="200" y1="45" x2="205" y2="65" stroke="#4aa3ff" stroke-width="3"/>' +
          '<line x1="230" y1="55" x2="235" y2="75" stroke="#4aa3ff" stroke-width="3"/>' +
          '<line x1="250" y1="90" x2="255" y2="110" stroke="#4aa3ff" stroke-width="3"/>'
      );
    } else if (id === 'scene-object-fahrrad') {
      parts.push(
        '<circle cx="95" cy="160" r="40" fill="none" stroke="#222" stroke-width="5"/>' +
          '<circle cx="230" cy="160" r="40" fill="none" stroke="#222" stroke-width="5"/>' +
          '<circle cx="95" cy="160" r="6" fill="#222"/><circle cx="230" cy="160" r="6" fill="#222"/>' +
          // 1.2.1 (I-27): closed frame, fork to the front hub, saddle and handlebar
          '<path d="M95,160 L150,160 L140,104 Z" fill="none" stroke="#2a6fdb" stroke-width="5" stroke-linejoin="round"/>' +
          '<path d="M140,104 L208,108 L150,160" fill="none" stroke="#2a6fdb" stroke-width="5" stroke-linejoin="round"/>' +
          '<line x1="208" y1="108" x2="230" y2="160" stroke="#2a6fdb" stroke-width="5"/>' +
          '<line x1="140" y1="104" x2="136" y2="92" stroke="#222" stroke-width="4"/>' +
          '<path d="M122,88 L150,88 Q152,94 146,95 L126,95 Q120,94 122,88 Z" fill="#222"/>' +
          '<line x1="208" y1="108" x2="204" y2="86" stroke="#222" stroke-width="4"/>' +
          '<line x1="194" y1="84" x2="218" y2="84" stroke="#222" stroke-width="5" stroke-linecap="round"/>' +
          '<circle cx="150" cy="160" r="10" fill="none" stroke="#444" stroke-width="3"/>' +
          '<line x1="150" y1="160" x2="135" y2="185" stroke="#444" stroke-width="3"/>' +
          '<line x1="150" y1="160" x2="165" y2="185" stroke="#444" stroke-width="3"/>' +
          '<rect x="128" y="183" width="14" height="6" fill="#222"/><rect x="158" y="183" width="14" height="6" fill="#222"/>'
      );
    } else if (id === 'scene-object-schiff') {
      parts.push(
        '<rect x="0" y="160" width="320" height="80" fill="#7eb6e8"/>' +
          '<path d="M40,160 L280,160 L250,200 L70,200 Z" fill="#5a6570" stroke="#2a3038" stroke-width="2"/>' +
          '<rect x="100" y="110" width="110" height="50" fill="#dfe6ee" stroke="#2a3038" stroke-width="2"/>' +
          '<rect x="120" y="80" width="30" height="30" fill="#9aa7b5"/><rect x="170" y="90" width="25" height="20" fill="#9aa7b5"/>' +
          '<rect x="145" y="50" width="8" height="60" fill="#333"/>' +
          '<line x1="0" y1="160" x2="320" y2="160" stroke="#2a6fdb" stroke-width="3"/>'
      );
    } else {
      parts.push('<rect x="80" y="70" width="160" height="100" fill="#ccc"/>');
    }
    return wrap(vb(p, [0, 0, 320, 240]), parts.join(''), contract.accessibleNeutralLabelDe);
  }

  function render(contract, variant) {
    if (!contract) return wrap('0 0 100 80', '<rect width="100" height="80" fill="#eee"/>', 'Abbildung');
    switch (contract.model) {
      case 'count_array':
        return renderCountArray(contract, variant);
      case 'color_swatch':
        return renderColorSwatch(contract);
      case 'circle':
        return renderCircle(contract);
      case 'polygon':
        return renderPolygon(contract);
      case 'rect':
        return renderRect(contract);
      case 'cube_oblique':
        return renderCube(contract);
      case 'sphere':
        return renderSphere(contract);
      case 'spatial_arrangement':
        return renderSpatial(contract);
      case 'highlighted_count_array':
        return renderHalf(contract, variant);
      case 'table_grid':
        return renderTable(contract, variant);
      case 'authored_object_illustration':
        return renderObject(contract);
      default:
        return wrap('0 0 100 80', '<rect width="100" height="80" fill="#eee"/>', contract.accessibleNeutralLabelDe || 'Abbildung');
    }
  }

  function mount(el, contract, variant) {
    if (!el) return;
    el.innerHTML = render(contract, variant);
    const svg = el.querySelector('svg');
    if (svg) {
      svg.style.width = '100%';
      svg.style.height = 'auto';
      svg.style.display = 'block';
    }
  }

  global.WortschatzScenes = { render: render, mount: mount };
})(typeof window !== 'undefined' ? window : globalThis);
