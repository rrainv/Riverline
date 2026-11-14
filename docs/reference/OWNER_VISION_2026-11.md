# Riverline Rework: Vision

## Purpose

Riverline has to be an app people actually want to use, not just a side project. Its main goal is to help people learn, and its success depends on people using it to study their poker. The other features, such as game nights, support that goal.

The core principle is not to overpromise. We should never misrepresent our sources, and we should use only the sources we can rely on for numbers. I want to improve our math, sources, and solvers so the app is as reliable as possible.

## Features

The current features are full hand analysis, spot analysis, spot and hand generation, equity runouts, equity calculations in general, game nights, and settings. I like what we have, and I think we can build on it. A new base without the legacy code should make that much easier.

We can add more modes, such as 1v1, and more features that make the app feel alive, like the coach Chippy. These can come later, but the rework should be designed so new features fit in without reworking everything else.

Some features I'd like to explore:
- **Live analysis** for reviewing hands and situations. It should never be advice for use during real play, since live decision-making is not allowed in poker.
- **Studying patterns** and **personal strategy** tracking, which we couldn't work on in the current repo because of the bugs and cleanup.
- **Playing hands with friends** and **registering real games** as part of game nights.

## Release and Business Model

I want to release Riverline to the community and possibly the internet, either as a web app or eventually as a native app. It should be free. I'd like to accept donations, or possibly offer a subscription, but paid options should only add extras and never limit the features people have.

## Platform and Codebase

This should be a new, clean repo, separate from the old one so we can always go back to it if I lose motivation. The old repo can be cleaned up at milestones, but the new project should not depend on legacy code I wrote without realizing how big the project would become.

I'm not sure yet which platform is best. Web is the easiest for testing, and that's what we've been using. But opening a web app feels less exciting than a desktop or phone app, and a different approach might help my motivation. We should discuss this.

## Design

The look and feel should feel premium, natural, human, and alive, with animations and smooth movement. We can take inspiration from apps with strong design, including the style and motion patterns in the video that was recently shared. The design should not look generic or like typical AI-generated UI.

The current direction is fine overall, but the mockups haven't reached the quality I want. They feel out of place. We should explore other visual options and aim for mockups that look good before implementation.

## Workflow

The development process should depend less on code and be more efficient. Current Claude sessions are long, and I have to approve every step, send updates to the manager chat, commit and push, and then keep working on tickets. That's too slow.

I believe we can build something good without the most powerful and expensive models. If we accept a result that's about 75% as polished but takes much less time, tokens, and effort, that's a good trade.

Bugs should not be fixed immediately as they appear. We should write them down, come back to them later, and fix the things I don't like on a planned schedule. Since Riverline isn't a live product, there's no need for emergency patches. The process should have:
- A **static workflow** that moves steadily forward.
- A **dynamic subflow** for bug fixes, which can use a cheap, fast model such as Haiku. It doesn't need much attention and doesn't have to be a priority for a long time.

## Long-Term Vision

Riverline should be something people come back to regularly because they enjoy it, similar to how Duolingo works. It should be the app people use for everything poker-related: analyzing hands, playing out hands, training decisions, playing with friends, and logging real games and game nights.

I have many more ideas, but the current process of bug fixing and slow workflows takes up so much of the available time that I can't get to them.