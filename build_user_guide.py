from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, KeepTogether
)


OUT = Path('help/Electrical-Open-User-Guide.pdf')
GREEN = colors.HexColor('#0a2b20')
MINT = colors.HexColor('#67cf98')
PALE = colors.HexColor('#eaf8ef')
INK = colors.HexColor('#18231f')
MUTED = colors.HexColor('#4d6257')


styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    name='GuideTitle', parent=styles['Title'], fontName='Helvetica-Bold',
    fontSize=23, leading=27, textColor=GREEN, spaceAfter=6,
))
styles.add(ParagraphStyle(
    name='Kicker', parent=styles['Normal'], fontName='Helvetica-Bold',
    fontSize=9, leading=12, textColor=MUTED, spaceAfter=4,
    uppercase=True, tracking=1.2,
))
styles.add(ParagraphStyle(
    name='GuideH1', parent=styles['Heading1'], fontName='Helvetica-Bold',
    fontSize=16, leading=20, textColor=GREEN, spaceBefore=2, spaceAfter=7,
))
styles.add(ParagraphStyle(
    name='GuideH2', parent=styles['Heading2'], fontName='Helvetica-Bold',
    fontSize=12, leading=15, textColor=GREEN, spaceBefore=10, spaceAfter=4,
))
styles.add(ParagraphStyle(
    name='GuideBody', parent=styles['BodyText'], fontName='Helvetica',
    fontSize=10.2, leading=14.4, textColor=INK, spaceAfter=6,
))
styles.add(ParagraphStyle(
    name='GuideBullet', parent=styles['BodyText'], fontName='Helvetica',
    fontSize=10.2, leading=14.4, textColor=INK, leftIndent=12, firstLineIndent=-10,
    spaceAfter=5,
))
styles.add(ParagraphStyle(
    name='GuideNote', parent=styles['BodyText'], fontName='Helvetica-Bold',
    fontSize=10, leading=14, textColor=GREEN, backColor=PALE,
    borderColor=MINT, borderWidth=0.8, borderPadding=8, spaceBefore=5, spaceAfter=9,
))
styles.add(ParagraphStyle(
    name='GuideSmall', parent=styles['BodyText'], fontName='Helvetica',
    fontSize=8.5, leading=11.5, textColor=MUTED, spaceBefore=7,
))


def P(text, style='GuideBody'):
    return Paragraph(text, styles[style])


def bullet(text):
    return P('&bull; ' + text, 'GuideBullet')


def header(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setStrokeColor(MINT)
    canvas.setLineWidth(0.8)
    canvas.line(18 * mm, height - 15 * mm, width - 18 * mm, height - 15 * mm)
    canvas.setFont('Helvetica-Bold', 8)
    canvas.setFillColor(GREEN)
    canvas.drawString(18 * mm, height - 11 * mm, 'ELECTRICAL OPEN GOLF SOCIETY')
    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(width - 18 * mm, 12 * mm, f'Page {doc.page}')
    canvas.restoreState()


def build():
    doc = SimpleDocTemplate(
        str(OUT), pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm,
        topMargin=23 * mm, bottomMargin=20 * mm,
        title='Electrical Open app guide', author='Electrical Open Golf Society',
    )
    story = []
    story += [
        P('ELECTRICAL OPEN GOLF SOCIETY', 'Kicker'),
        P('Electrical Open app guide', 'GuideTitle'),
        P('A practical guide for society members - updated September 2026', 'GuideBody'),
        P('Use the app to view your handicap, fixtures, results and Order of Merit; receive fixture updates; and enter a paired scorecard when score entry is open.', 'GuideNote'),
        P('1. Sign in and add the app to your phone', 'GuideH1'),
        bullet('<b>Sign in:</b> open electrical-open.pages.dev and use the email address registered by the society administrator.'),
        bullet('<b>First-time access:</b> use the eight-digit code in your invitation email to choose your own password.'),
        bullet('<b>iPhone / iPad:</b> open the app in Safari, tap Share, then choose <b>Add to Home Screen</b>.'),
        bullet('<b>Android:</b> open the app in Chrome, tap the three-dot menu, then choose <b>Install app</b> or <b>Add to Home screen</b>.'),
        P('Your home screen', 'GuideH2'),
        P('The home screen shows your current society index, recent differentials, the next fixture and recent completed fixtures. The latest updates section shows recent society notices.'),
        PageBreak(),
        P('Member information', 'GuideTitle'),
        P('Fixtures, results, handicap history and Order of Merit', 'GuideBody'),
        P('2. Fixtures and results', 'GuideH1'),
        bullet('Open <b>Fixtures</b> from the bottom navigation.'),
        bullet('Fixtures and completed results are separated and grouped by year.'),
        bullet('Tap a fixture to view the start sheet, playing handicaps, results and the course scorecard when one is available.'),
        bullet('Tap a player name in a completed result to view their hole-by-hole scorecard, where one is available.'),
        bullet('Historical results are read-only and are kept separately from current-season fixtures.'),
        P('3. Handicap and Order of Merit', 'GuideH1'),
        bullet('Open <b>Handicap</b> to see your index, club handicap and recent score differentials.'),
        bullet('If your club handicap is lower than your society index, the app tells you that the club handicap is being used.'),
        bullet('Open <b>Merit</b> to see the Order of Merit for the selected season. Tap a player to see events attended and points awarded.'),
        P('4. Entering a scorecard', 'GuideH1'),
        bullet('Open <b>Scorecard</b> from the middle bottom button. It is linked to the current fixture.'),
        bullet('Select Player A - the participant whose score you are marking - then enter strokes for both players.'),
        bullet('Stableford points calculate automatically. Drafts save automatically; use <b>Review &amp; submit</b> only after checking with your playing partner.'),
        bullet('If you cannot complete the round, ask an administrator to record a Non Return (NR).'),
        PageBreak(),
        P('Notifications', 'GuideTitle'),
        P('New fixtures, changed fixture dates or tee times, and published results', 'GuideBody'),
        P('5. Turn notifications on', 'GuideH1'),
        bullet('Sign in, then tap your initials at the top of the app.'),
        bullet('Choose <b>Enable fixture notifications</b> and allow the browser or phone permission request.'),
        bullet('The bell beside your initials is green when notifications are active on that device.'),
        P('Important: enable notifications on each phone or computer separately. Private / Incognito browsing does not receive browser notifications.', 'GuideNote'),
        P('Android phone or tablet - Chrome', 'GuideH2'),
        bullet('Use Chrome to open Electrical Open. If possible, install it to the Home screen first.'),
        bullet('If Chrome asks, choose <b>Allow</b>. If no request appears, tap the icon to the left of the address bar, open <b>Permissions</b>, then set <b>Notifications</b> to <b>Allow</b>.'),
        bullet('If Chrome shows electrical-open.pages.dev as <b>Automatically blocked</b>: in Chrome go to <b>three dots &gt; Settings &gt; Site settings &gt; Notifications</b>. Find Electrical Open under Not allowed, open it or use its three-dot menu, then choose <b>Allow</b> or <b>Reset permissions</b>. Return to the app, reload it, and choose Enable fixture notifications again.'),
        bullet('Also make sure the main setting <b>Sites can ask to send notifications</b> is switched on.'),
        P('Android - other browsers', 'GuideH2'),
        bullet('Chrome is the recommended Android browser. In Edge or Samsung Internet, open the site permissions / notifications settings for electrical-open.pages.dev and set Notifications to <b>Allow</b>, then return to the app and enable notifications.'),
        PageBreak(),
        P('Notifications - iPhone, iPad and computers', 'GuideTitle'),
        P('6. iPhone or iPad', 'GuideH1'),
        bullet('Open Electrical Open in <b>Safari</b> - not an in-app browser opened from email or a message.'),
        bullet('Tap Share, choose <b>Add to Home Screen</b>, then open Electrical Open from the new Home Screen icon.'),
        bullet('Tap your initials and choose <b>Enable fixture notifications</b>. When iPhone/iPad asks, choose <b>Allow</b>.'),
        bullet('To change this later, open <b>Settings &gt; Notifications &gt; Electrical Open</b> and allow notifications. The Electrical Open entry appears after permission has been requested.'),
        P('Windows or Mac - Chrome, Edge or Safari', 'GuideH1'),
        bullet('Open electrical-open.pages.dev, sign in, tap your initials, and choose Enable fixture notifications.'),
        bullet('If the browser has blocked the request, click the padlock / site-information icon beside the address bar. Find <b>Notifications</b> and set it to <b>Allow</b>, then reload the app.'),
        bullet('In Chrome, you can also use <b>Settings &gt; Privacy and security &gt; Site settings &gt; Notifications</b>. In Edge, use <b>Settings &gt; Cookies and site permissions &gt; All sites</b>, select Electrical Open, then set Notifications to Allow.'),
        P('7. If notifications still do not arrive', 'GuideH1'),
        bullet('Check the bell beside your initials is green and that the phone is not in Do Not Disturb / Focus mode.'),
        bullet('Open the app once after an update and sign in again if requested.'),
        bullet('Try turning notifications off and back on from your initials menu. This only changes this device.'),
        bullet('If there is still a problem, send the society administrator a screenshot showing the browser or phone notification setting.'),
        P('You can turn notifications off at any time from the initials menu or your browser / device notification settings.', 'GuideNote'),
        PageBreak(),
        P('Support', 'GuideTitle'),
        P('Where to find help and what to send an administrator', 'GuideBody'),
        P('Need help?', 'GuideH1'),
        bullet('Use the <b>Help</b> button in the app header to open or download the latest guide.'),
        bullet('For access, account or scorecard issues, contact a society administrator.'),
        bullet('If you have forgotten your password, choose <b>Forgot password?</b> on the sign-in screen.'),
        P('Useful information when reporting an issue', 'GuideH2'),
        bullet('Say which phone, tablet or computer you are using and which browser you opened the app with.'),
        bullet('Include a screenshot of any message shown. Do not send your password, reset code or login token.'),
        bullet('For notifications, tell the administrator whether the bell is green, hidden, or whether the phone browser says the site is blocked.'),
        P('The society administrator can help with app access, fixture information and scorecard questions. Technical settings are kept separate so members do not need to manage them.', 'GuideNote'),
        P('Browser setting paths can vary slightly between phone versions. If a label differs, look for Site settings, Permissions, or Notifications.', 'GuideSmall'),
    ]
    doc.build(story, onFirstPage=header, onLaterPages=header)


if __name__ == '__main__':
    build()
