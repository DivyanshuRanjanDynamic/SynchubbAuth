import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';

class GitHubSync {
  constructor(room) {
    this.room = room;
    this.repositories = new Map();
    this.issues = new Map();
    this.projects = new Map();
    this.milestones = new Map();
    this.webhooks = new Map();
    this.octokit = null;
  }

  async initialize(config) {
    this.octokit = new Octokit({
      auth: config.token,
      userAgent: 'VideoCall-App/1.0.0'
    });
  }

  // Repository Management
  async addRepository(owner, repo) {
    try {
      const repository = await this.octokit.repos.get({ owner, repo });
      this.repositories.set(`${owner}/${repo}`, {
        ...repository.data,
        syncedAt: new Date(),
        issues: new Map(),
        projects: new Map(),
        milestones: new Map()
      });
      await this.setupWebhook(owner, repo);
      return repository.data;
    } catch (error) {
      throw new Error(`Failed to add repository: ${error.message}`);
    }
  }

  async removeRepository(owner, repo) {
    const repoKey = `${owner}/${repo}`;
    if (this.webhooks.has(repoKey)) {
      await this.removeWebhook(owner, repo);
    }
    return this.repositories.delete(repoKey);
  }

  // Issue Management
  async syncIssues(owner, repo) {
    try {
      const repoKey = `${owner}/${repo}`;
      const repository = this.repositories.get(repoKey);
      if (!repository) throw new Error('Repository not found');

      const { data: issues } = await this.octokit.issues.listForRepo({
        owner,
        repo,
        state: 'all',
        per_page: 100
      });

      repository.issues.clear();
      issues.forEach(issue => {
        repository.issues.set(issue.number, {
          ...issue,
          syncedAt: new Date()
        });
      });

      return Array.from(repository.issues.values());
    } catch (error) {
      throw new Error(`Failed to sync issues: ${error.message}`);
    }
  }

  async createIssue(owner, repo, data) {
    try {
      const { data: issue } = await this.octokit.issues.create({
        owner,
        repo,
        ...data
      });

      const repoKey = `${owner}/${repo}`;
      const repository = this.repositories.get(repoKey);
      if (repository) {
        repository.issues.set(issue.number, {
          ...issue,
          syncedAt: new Date()
        });
      }

      return issue;
    } catch (error) {
      throw new Error(`Failed to create issue: ${error.message}`);
    }
  }

  async updateIssue(owner, repo, issueNumber, data) {
    try {
      const { data: issue } = await this.octokit.issues.update({
        owner,
        repo,
        issue_number: issueNumber,
        ...data
      });

      const repoKey = `${owner}/${repo}`;
      const repository = this.repositories.get(repoKey);
      if (repository) {
        repository.issues.set(issue.number, {
          ...issue,
          syncedAt: new Date()
        });
      }

      return issue;
    } catch (error) {
      throw new Error(`Failed to update issue: ${error.message}`);
    }
  }

  // Project Management
  async syncProjects(owner, repo) {
    try {
      const repoKey = `${owner}/${repo}`;
      const repository = this.repositories.get(repoKey);
      if (!repository) throw new Error('Repository not found');

      const { data: projects } = await this.octokit.projects.listForRepo({
        owner,
        repo
      });

      repository.projects.clear();
      projects.forEach(project => {
        repository.projects.set(project.number, {
          ...project,
          syncedAt: new Date()
        });
      });

      return Array.from(repository.projects.values());
    } catch (error) {
      throw new Error(`Failed to sync projects: ${error.message}`);
    }
  }

  async createProject(owner, repo, data) {
    try {
      const { data: project } = await this.octokit.projects.createForRepo({
        owner,
        repo,
        ...data
      });

      const repoKey = `${owner}/${repo}`;
      const repository = this.repositories.get(repoKey);
      if (repository) {
        repository.projects.set(project.number, {
          ...project,
          syncedAt: new Date()
        });
      }

      return project;
    } catch (error) {
      throw new Error(`Failed to create project: ${error.message}`);
    }
  }

  // Milestone Management
  async syncMilestones(owner, repo) {
    try {
      const repoKey = `${owner}/${repo}`;
      const repository = this.repositories.get(repoKey);
      if (!repository) throw new Error('Repository not found');

      const { data: milestones } = await this.octokit.issues.listMilestones({
        owner,
        repo,
        state: 'all'
      });

      repository.milestones.clear();
      milestones.forEach(milestone => {
        repository.milestones.set(milestone.number, {
          ...milestone,
          syncedAt: new Date()
        });
      });

      return Array.from(repository.milestones.values());
    } catch (error) {
      throw new Error(`Failed to sync milestones: ${error.message}`);
    }
  }

  async migrateMilestone(sourceOwner, sourceRepo, milestoneNumber, targetOwner, targetRepo) {
    try {
      const sourceKey = `${sourceOwner}/${sourceRepo}`;
      const sourceRepo = this.repositories.get(sourceKey);
      if (!sourceRepo) throw new Error('Source repository not found');

      const milestone = sourceRepo.milestones.get(milestoneNumber);
      if (!milestone) throw new Error('Milestone not found');

      const { data: newMilestone } = await this.octokit.issues.createMilestone({
        owner: targetOwner,
        repo: targetRepo,
        title: milestone.title,
        description: milestone.description,
        due_on: milestone.due_on,
        state: milestone.state
      });

      const targetKey = `${targetOwner}/${targetRepo}`;
      const targetRepo = this.repositories.get(targetKey);
      if (targetRepo) {
        targetRepo.milestones.set(newMilestone.number, {
          ...newMilestone,
          syncedAt: new Date()
        });
      }

      return newMilestone;
    } catch (error) {
      throw new Error(`Failed to migrate milestone: ${error.message}`);
    }
  }

  // Contribution Tracking
  async getContributions(owner, repo, since) {
    try {
      const { data: commits } = await this.octokit.repos.listCommits({
        owner,
        repo,
        since,
        per_page: 100
      });

      return commits.map(commit => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: commit.author,
        date: commit.commit.author.date,
        stats: commit.stats
      }));
    } catch (error) {
      throw new Error(`Failed to get contributions: ${error.message}`);
    }
  }

  // Advanced Filtering
  async searchIssues(query, filters = {}) {
    try {
      const q = [query];
      
      if (filters.state) q.push(`state:${filters.state}`);
      if (filters.labels) q.push(`label:${filters.labels.join(',')}`);
      if (filters.assignee) q.push(`assignee:${filters.assignee}`);
      if (filters.milestone) q.push(`milestone:${filters.milestone}`);
      if (filters.created) q.push(`created:${filters.created}`);
      if (filters.updated) q.push(`updated:${filters.updated}`);

      const { data } = await this.octokit.search.issuesAndPullRequests({
        q: q.join(' '),
        sort: filters.sort || 'created',
        order: filters.order || 'desc',
        per_page: filters.per_page || 30,
        page: filters.page || 1
      });

      return data.items;
    } catch (error) {
      throw new Error(`Failed to search issues: ${error.message}`);
    }
  }

  // Webhook Management
  async setupWebhook(owner, repo) {
    try {
      const { data: webhook } = await this.octokit.repos.createWebhook({
        owner,
        repo,
        config: {
          url: `${this.room.webhookUrl}/github`,
          content_type: 'json',
          secret: this.room.webhookSecret
        },
        events: ['issues', 'project', 'milestone']
      });

      this.webhooks.set(`${owner}/${repo}`, webhook);
      return webhook;
    } catch (error) {
      throw new Error(`Failed to setup webhook: ${error.message}`);
    }
  }

  async removeWebhook(owner, repo) {
    try {
      const repoKey = `${owner}/${repo}`;
      const webhook = this.webhooks.get(repoKey);
      if (!webhook) return;

      await this.octokit.repos.deleteWebhook({
        owner,
        repo,
        hook_id: webhook.id
      });

      this.webhooks.delete(repoKey);
    } catch (error) {
      throw new Error(`Failed to remove webhook: ${error.message}`);
    }
  }

  // Event Handlers
  handleWebhookEvent(event, payload) {
    const repoKey = `${payload.repository.owner.login}/${payload.repository.name}`;
    const repository = this.repositories.get(repoKey);
    if (!repository) return;

    switch (event) {
      case 'issues':
        this.handleIssueEvent(repository, payload);
        break;
      case 'project':
        this.handleProjectEvent(repository, payload);
        break;
      case 'milestone':
        this.handleMilestoneEvent(repository, payload);
        break;
    }
  }

  handleIssueEvent(repository, payload) {
    const issue = payload.issue;
    switch (payload.action) {
      case 'opened':
      case 'edited':
      case 'closed':
      case 'reopened':
        repository.issues.set(issue.number, {
          ...issue,
          syncedAt: new Date()
        });
        break;
      case 'deleted':
        repository.issues.delete(issue.number);
        break;
    }
    this.room.io.to(this.room.id).emit('githubIssueUpdate', {
      repository: repository.full_name,
      action: payload.action,
      issue
    });
  }

  handleProjectEvent(repository, payload) {
    const project = payload.project;
    switch (payload.action) {
      case 'created':
      case 'edited':
      case 'closed':
      case 'reopened':
        repository.projects.set(project.number, {
          ...project,
          syncedAt: new Date()
        });
        break;
      case 'deleted':
        repository.projects.delete(project.number);
        break;
    }
    this.room.io.to(this.room.id).emit('githubProjectUpdate', {
      repository: repository.full_name,
      action: payload.action,
      project
    });
  }

  handleMilestoneEvent(repository, payload) {
    const milestone = payload.milestone;
    switch (payload.action) {
      case 'created':
      case 'edited':
      case 'closed':
      case 'opened':
        repository.milestones.set(milestone.number, {
          ...milestone,
          syncedAt: new Date()
        });
        break;
      case 'deleted':
        repository.milestones.delete(milestone.number);
        break;
    }
    this.room.io.to(this.room.id).emit('githubMilestoneUpdate', {
      repository: repository.full_name,
      action: payload.action,
      milestone
    });
  }

  // Cleanup
  clear() {
    for (const [owner, repo] of this.repositories.keys()) {
      this.removeRepository(owner, repo);
    }
    this.repositories.clear();
    this.issues.clear();
    this.projects.clear();
    this.milestones.clear();
    this.webhooks.clear();
  }
}

export default  GitHubSync;