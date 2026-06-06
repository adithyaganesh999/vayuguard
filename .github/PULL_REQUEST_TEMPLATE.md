## Description

<!-- Provide a clear description of the changes in this PR -->

## Type of Change

<!-- Mark the relevant option with an 'x' -->

- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 🔧 Configuration change (environment variables, CI/CD, infrastructure)
- [ ] 📊 Data pipeline change (ingestion, transformation, quality checks)
- [ ] 🤖 ML model change (new model, retraining, feature engineering)
- [ ] 🎨 UI/UX change (frontend components, styling, layout)
- [ ] ♻️ Refactor (code improvement without functional changes)
- [ ] 📝 Documentation update
- [ ] 🔒 Security fix

## Affected Services

<!-- Mark which services are affected -->

- [ ] Frontend (mern-frontend)
- [ ] Backend (mern-backend)
- [ ] ML Service (ml-service)
- [ ] Data Pipeline (data-pipeline)
- [ ] Infrastructure (infrastructure/)
- [ ] Documentation (docs/)

## Checklist

### General

- [ ] My code follows the project's coding standards
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings or errors
- [ ] I have checked my code for any security vulnerabilities

### Testing

- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] I have tested edge cases and error conditions
- [ ] I have verified the changes work in the staging environment (if applicable)

### Database Changes

- [ ] I have updated the database schema (if applicable)
- [ ] I have added a migration file (if applicable)
- [ ] I have verified the migration is reversible
- [ ] I have updated the data schema documentation in `docs/architecture/data-schema.md`

### ML Model Changes

- [ ] I have updated the model version number
- [ ] I have verified model accuracy meets thresholds (MAE < 15, RMSE < 25, R² > 0.80)
- [ ] I have updated the model card in `docs/handover/ai-ml-handover.md`
- [ ] I have run the backtest and results are acceptable
- [ ] I have registered the model in MLflow

### Breaking Changes

- [ ] I have documented any breaking changes below
- [ ] I have updated the API documentation
- [ ] I have notified downstream consumers
- [ ] I have added deprecation notices (if gradually phasing out)

## Breaking Changes

<!-- If this PR includes breaking changes, describe them here -->
<!-- Include migration instructions for consumers -->

_None._

## Testing Instructions

<!-- Describe how to test the changes -->

1.
2.
3.

## Screenshots / Recordings

<!-- If applicable, add screenshots or recordings to help explain your changes -->

## Related Issues

<!-- Link any related issues: Fixes #123, Relates to #456 -->

## Additional Notes

<!-- Any additional context, dependencies, or considerations -->
